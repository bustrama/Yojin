/**
 * GraphQL resolvers for Strategies — trading strategy management.
 */

import type { JintelClient } from '@yojinhq/jintel-client';

import { createSubsystemLogger } from '../../../logging/logger.js';
import type { PortfolioSnapshotStore } from '../../../portfolio/snapshot-store.js';
import { DataCapabilitySchema, deriveCapabilities } from '../../../strategies/capabilities.js';
import { parseFromMarkdown, serializeToMarkdown, slugify } from '../../../strategies/strategy-serializer.js';
import type { StrategyStore } from '../../../strategies/strategy-store.js';
import type { TickerSuggester, TickerSuggestion } from '../../../strategies/ticker-suggester.js';
import { StrategyStyleSchema, TargetWeightsSchema, TriggerTypeSchema } from '../../../strategies/types.js';
import type { Strategy, StrategyCategory, StrategyStyle, TargetWeights } from '../../../strategies/types.js';
import type { WatchlistStore } from '../../../watchlist/watchlist-store.js';

const log = createSubsystemLogger('strategy-resolver');

// ---------------------------------------------------------------------------
// State — wired by composition root
// ---------------------------------------------------------------------------

let strategyStore: StrategyStore | null = null;
let tickerSuggester: TickerSuggester | null = null;
let portfolioSnapshotStore: PortfolioSnapshotStore | null = null;
let watchlistStore: WatchlistStore | null = null;
let suggestionJintelClient: JintelClient | null = null;

export function setStrategyStore(store: StrategyStore): void {
  strategyStore = store;
}

export function setStrategySuggestionDeps(deps: {
  tickerSuggester: TickerSuggester;
  snapshotStore: PortfolioSnapshotStore;
  watchlistStore: WatchlistStore;
  jintelClient: JintelClient | undefined;
}): void {
  tickerSuggester = deps.tickerSuggester;
  portfolioSnapshotStore = deps.snapshotStore;
  watchlistStore = deps.watchlistStore;
  suggestionJintelClient = deps.jintelClient ?? null;
}

// ---------------------------------------------------------------------------
// Capability mapping (domain snake_case ↔ GraphQL SCREAMING_SNAKE_CASE)
// Derived from DataCapabilitySchema to stay in sync automatically.
// ---------------------------------------------------------------------------

const CAPABILITY_TO_GQL: Record<string, string> = Object.fromEntries(
  DataCapabilitySchema.options.map((c) => [c, c.toUpperCase()]),
);

const STYLE_TO_GQL: Record<string, string> = Object.fromEntries(
  StrategyStyleSchema.options.map((s) => [s, s.toUpperCase()]),
);

const GQL_TO_STYLE: Record<string, StrategyStyle> = Object.fromEntries(
  StrategyStyleSchema.options.map((s) => [s.toUpperCase(), s]),
);

// ---------------------------------------------------------------------------
// Query resolvers
// ---------------------------------------------------------------------------

export function resolveStrategies(
  _: unknown,
  args: { category?: StrategyCategory; active?: boolean; style?: string; query?: string },
): unknown[] {
  if (!strategyStore) return [];
  let strategies = strategyStore.getAll();
  if (args.category) {
    strategies = strategies.filter((s) => s.category === args.category);
  }
  if (args.active !== undefined) {
    strategies = strategies.filter((s) => s.active === args.active);
  }
  if (args.style) {
    const internalStyle = GQL_TO_STYLE[args.style] ?? args.style.toLowerCase();
    strategies = strategies.filter((s) => s.style === internalStyle);
  }
  if (args.query) {
    const q = args.query.toLowerCase();
    strategies = strategies.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.content.toLowerCase().includes(q),
    );
  }
  return strategies.map(toGraphQL);
}

export function resolveStrategy(_: unknown, args: { id: string }): unknown | null {
  if (!strategyStore) return null;
  const strategy = strategyStore.getById(args.id);
  return strategy ? toGraphQL(strategy) : null;
}

export function resolveExportStrategy(_: unknown, args: { id: string }): string {
  if (!strategyStore) throw new Error('Strategy store not initialized');
  const strategy = strategyStore.getById(args.id);
  if (!strategy) throw new Error(`Strategy not found: ${args.id}`);
  return serializeToMarkdown(strategy);
}

export async function resolveSuggestTickersForStrategy(_: unknown, args: { id: string }): Promise<unknown[]> {
  if (!strategyStore) throw new Error('Strategy store not initialized');
  if (!tickerSuggester || !portfolioSnapshotStore) {
    throw new Error('Ticker suggester not configured — AI provider or portfolio store missing');
  }
  const strategy = strategyStore.getById(args.id);
  if (!strategy) throw new Error(`Strategy not found: ${args.id}`);

  const exclude = new Set<string>();
  const snapshot = await portfolioSnapshotStore.getLatest();
  for (const position of snapshot?.positions ?? []) {
    exclude.add(position.symbol.toUpperCase());
  }
  // Also exclude anything already on the watchlist so we don't re-propose it.
  for (const entry of watchlistStore?.list() ?? []) {
    exclude.add(entry.symbol.toUpperCase());
  }

  const suggestions = await tickerSuggester.suggest({ strategy, excludeSymbols: exclude });
  return verifySuggestions(suggestions);
}

/**
 * Verify LLM-proposed tickers against Jintel before returning them to the UI.
 * The LLM can hallucinate symbols or mislabel asset classes; the watchlist and
 * downstream enrichment pipelines trust what we write. Only keep suggestions
 * whose symbol resolves to a real Jintel entity, and replace the LLM-supplied
 * name / assetClass with the canonical values from Jintel.
 */
async function verifySuggestions(suggestions: TickerSuggestion[]): Promise<TickerSuggestion[]> {
  if (suggestions.length === 0) return [];
  if (!suggestionJintelClient) {
    log.warn('Ticker suggestions dropped — Jintel client not configured for verification');
    return [];
  }
  const client = suggestionJintelClient;

  const verified = await Promise.all(
    suggestions.map(async (suggestion) => {
      const symbol = suggestion.symbol.toUpperCase();
      const result = await client.searchEntities(symbol, { limit: 5 }).catch((err: unknown) => {
        log.warn('Jintel searchEntities failed during suggestion verification', {
          symbol,
          error: err instanceof Error ? err.message : String(err),
        });
        return { success: false as const, error: 'searchEntities threw', data: [] as never[] };
      });
      if (!result.success) return null;

      const match = result.data.find((entity) => (entity.tickers ?? []).some((t) => t.toUpperCase() === symbol));
      if (!match) return null;

      const assetClass = jintelTypeToAssetClass(match.type);
      if (!assetClass) return null;
      const parsed = match.tickers?.find((t) => t.toUpperCase() === symbol) ?? symbol;
      return {
        ...suggestion,
        symbol: parsed.toUpperCase(),
        name: match.name || suggestion.name,
        assetClass,
      } as TickerSuggestion;
    }),
  );

  return verified.filter((s): s is TickerSuggestion => s !== null);
}

/** Map Jintel EntityType → our AssetClass. Returns null for non-investable types (e.g. PERSON). */
function jintelTypeToAssetClass(type: string): TickerSuggestion['assetClass'] | null {
  switch (type) {
    case 'CRYPTO':
      return 'CRYPTO';
    case 'COMMODITY':
      return 'COMMODITY';
    case 'COMPANY':
    case 'INDEX':
      return 'EQUITY';
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Mutation resolvers
// ---------------------------------------------------------------------------

export function resolveToggleStrategy(_: unknown, args: { id: string; active: boolean }): unknown {
  if (!strategyStore) throw new Error('Strategy store not initialized');
  const updated = strategyStore.setActive(args.id, args.active);
  if (!updated) throw new Error(`Strategy not found: ${args.id}`);
  return toGraphQL(updated);
}

interface StrategyTriggerInput {
  type: string;
  description: string;
  params?: string;
}

interface TriggerGroupInput {
  label?: string;
  conditions: StrategyTriggerInput[];
}

interface CreateStrategyInput {
  name: string;
  description: string;
  category: StrategyCategory;
  style: string;
  content: string;
  triggerGroups: TriggerGroupInput[];
  tickers?: string[];
  maxPositionSize?: number;
  targetAllocation?: number;
  targetWeights?: string;
}

interface UpdateStrategyInput {
  name?: string;
  description?: string;
  category?: StrategyCategory;
  style?: string;
  content?: string;
  triggerGroups?: TriggerGroupInput[];
  tickers?: string[];
  maxPositionSize?: number;
  targetAllocation?: number;
  targetWeights?: string;
}

function mapTriggersFromInput(triggers: StrategyTriggerInput[]): Strategy['triggerGroups'][number]['conditions'] {
  return triggers.map((t, i) => {
    const typeParsed = TriggerTypeSchema.safeParse(t.type);
    if (!typeParsed.success) {
      throw new Error(`Invalid trigger type at index ${i}: ${t.type}`);
    }
    let params: Record<string, unknown> | undefined;
    if (t.params) {
      try {
        params = JSON.parse(t.params) as Record<string, unknown>;
      } catch {
        throw new Error(`Invalid trigger params JSON at index ${i}`);
      }
    }
    return {
      type: typeParsed.data,
      description: t.description,
      ...(params ? { params } : {}),
    };
  });
}

function mapTriggerGroupsFromInput(groups: TriggerGroupInput[]): Strategy['triggerGroups'] {
  return groups.map((g) => ({
    label: g.label ?? '',
    conditions: mapTriggersFromInput(g.conditions),
  }));
}

/** Parse a JSON-stringified target weights map. Empty string means "clear". */
function parseTargetWeightsInput(raw: string | undefined): TargetWeights | undefined | null {
  if (raw === undefined) return undefined; // field not provided
  if (raw === '') return null; // explicit clear
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid targetWeights JSON');
  }
  const validated = TargetWeightsSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`Invalid targetWeights: ${validated.error.issues.map((i) => i.message).join(', ')}`);
  }
  return validated.data;
}

export function resolveCreateStrategy(_: unknown, args: { input: CreateStrategyInput }): unknown {
  if (!strategyStore) throw new Error('Strategy store not initialized');
  const { input } = args;
  let id = slugify(input.name);
  const existing = strategyStore.getById(id);
  if (existing) {
    id = `${id}-${Date.now()}`;
  }
  const triggerGroups = mapTriggerGroupsFromInput(input.triggerGroups);
  const targetWeights = parseTargetWeightsInput(input.targetWeights);
  const strategy: Strategy = {
    id,
    name: input.name,
    description: input.description,
    category: input.category,
    style: GQL_TO_STYLE[input.style] ?? 'general',
    requires: deriveCapabilities(triggerGroups),
    active: false,
    source: 'custom',
    createdBy: 'user',
    createdAt: new Date().toISOString(),
    content: input.content,
    triggerGroups,
    tickers: input.tickers ?? [],
    assetClasses: [],
    ...(input.maxPositionSize !== undefined ? { maxPositionSize: input.maxPositionSize } : {}),
    ...(input.targetAllocation !== undefined ? { targetAllocation: input.targetAllocation } : {}),
    ...(targetWeights ? { targetWeights } : {}),
  };
  strategyStore.create(strategy);
  return toGraphQL(strategy);
}

export function resolveUpdateStrategy(_: unknown, args: { id: string; input: UpdateStrategyInput }): unknown {
  if (!strategyStore) throw new Error('Strategy store not initialized');
  const { id, input } = args;
  const fields: Partial<Omit<Strategy, 'id'>> = {};
  if (input.name !== undefined) fields.name = input.name;
  if (input.description !== undefined) fields.description = input.description;
  if (input.category !== undefined) fields.category = input.category;
  if (input.style !== undefined) fields.style = GQL_TO_STYLE[input.style] ?? 'general';
  if (input.content !== undefined) fields.content = input.content;
  if (input.triggerGroups !== undefined) {
    fields.triggerGroups = mapTriggerGroupsFromInput(input.triggerGroups);
    fields.requires = deriveCapabilities(fields.triggerGroups);
  }
  if (input.tickers !== undefined) fields.tickers = input.tickers;
  if (input.maxPositionSize !== undefined) fields.maxPositionSize = input.maxPositionSize;
  if (input.targetAllocation !== undefined) fields.targetAllocation = input.targetAllocation;
  if (input.targetWeights !== undefined) {
    const parsed = parseTargetWeightsInput(input.targetWeights);
    fields.targetWeights = parsed ?? undefined;
  }
  const updated = strategyStore.update(id, fields);
  return toGraphQL(updated);
}

export function resolveDeleteStrategy(_: unknown, args: { id: string }): boolean {
  if (!strategyStore) throw new Error('Strategy store not initialized');
  const deleted = strategyStore.delete(args.id);
  if (!deleted) throw new Error(`Strategy not found: ${args.id}`);
  return true;
}

export function resolveImportStrategy(_: unknown, args: { markdown: string }): unknown {
  if (!strategyStore) throw new Error('Strategy store not initialized');
  const strategy = parseFromMarkdown(args.markdown);
  if (strategyStore.getById(strategy.id)) {
    strategy.id = `${strategy.id}-${Date.now()}`;
  }
  strategyStore.create(strategy);
  return toGraphQL(strategy);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toGraphQL(strategy: Strategy): unknown {
  return {
    id: strategy.id,
    name: strategy.name,
    description: strategy.description,
    category: strategy.category,
    style: STYLE_TO_GQL[strategy.style] ?? strategy.style.toUpperCase(),
    requires: strategy.requires.map((r) => CAPABILITY_TO_GQL[r] ?? r.toUpperCase()),
    active: strategy.active,
    source: strategy.source,
    createdBy: strategy.createdBy,
    createdAt: strategy.createdAt,
    content: strategy.content,
    triggerGroups: strategy.triggerGroups.map((g) => ({
      label: g.label || null,
      conditions: g.conditions.map((t) => ({
        type: t.type,
        description: t.description,
        params: t.params ? JSON.stringify(t.params) : null,
      })),
    })),
    maxPositionSize: strategy.maxPositionSize ?? null,
    targetAllocation: strategy.targetAllocation ?? null,
    tickers: strategy.tickers,
    targetWeights: strategy.targetWeights ? JSON.stringify(strategy.targetWeights) : null,
  };
}
