import { createSubsystemLogger } from '../../../logging/logger.js';
import { fetchStrategiesFromSource } from '../../../strategies/strategy-source-fetcher.js';
import type { StrategySourceStore } from '../../../strategies/strategy-source-store.js';
import { syncFromFetched, syncStrategies } from '../../../strategies/strategy-source-sync.js';
import type { StrategySyncResult } from '../../../strategies/strategy-source-sync.js';
import { DEFAULT_SOURCE_ID, parseGitHubUrl } from '../../../strategies/strategy-source-types.js';
import type { StrategySource } from '../../../strategies/strategy-source-types.js';
import type { StrategyStore } from '../../../strategies/strategy-store.js';

const logger = createSubsystemLogger('strategy-source-resolvers');

let strategySourceStore: StrategySourceStore | null = null;
let strategyStore: StrategyStore | null = null;

export function setStrategySourceStore(store: StrategySourceStore): void {
  strategySourceStore = store;
}

export function setStrategyStoreForSources(store: StrategyStore): void {
  strategyStore = store;
}

function requireStores(): { sourceStore: StrategySourceStore; strategyStore: StrategyStore } {
  if (!strategySourceStore) throw new Error('Strategy source store not initialized');
  if (!strategyStore) throw new Error('Strategy store not initialized');
  return { sourceStore: strategySourceStore, strategyStore };
}

function toGraphQL(source: StrategySource) {
  return {
    id: source.id,
    owner: source.owner,
    repo: source.repo,
    path: source.path,
    ref: source.ref,
    enabled: source.enabled,
    lastSyncedAt: source.lastSyncedAt ?? null,
    label: source.label ?? null,
    isDefault: source.id === DEFAULT_SOURCE_ID,
  };
}

export function resolveStrategySources() {
  if (!strategySourceStore) return [];
  return strategySourceStore.getAll().map(toGraphQL);
}

export async function resolveAddStrategySource(_: unknown, args: { url: string }) {
  const { sourceStore, strategyStore } = requireStores();
  const parsed = parseGitHubUrl(args.url);
  const source = await sourceStore.add({
    owner: parsed.owner,
    repo: parsed.repo,
    path: parsed.path,
    ref: parsed.ref,
    enabled: true,
    label: `${parsed.owner}/${parsed.repo}`,
  });

  try {
    const { strategies } = await fetchStrategiesFromSource(source);
    await syncFromFetched(strategies, strategyStore, source);
    await sourceStore.updateLastSynced(source.id);
  } catch (err) {
    logger.warn('Initial sync failed for new source', { sourceId: source.id, error: err });
  }

  return toGraphQL(sourceStore.getById(source.id) ?? source);
}

export async function resolveRemoveStrategySource(_: unknown, args: { id: string }): Promise<boolean> {
  const { sourceStore } = requireStores();
  await sourceStore.remove(args.id);
  return true;
}

export async function resolveToggleStrategySource(_: unknown, args: { id: string; enabled: boolean }) {
  const { sourceStore } = requireStores();
  const updated = await sourceStore.setEnabled(args.id, args.enabled);
  return toGraphQL(updated);
}

export async function resolveSyncStrategies(): Promise<StrategySyncResult> {
  const { sourceStore, strategyStore } = requireStores();
  const enabled = sourceStore.getEnabled();
  return syncStrategies(enabled, strategyStore, sourceStore);
}

export async function resolveSyncStrategySource(_: unknown, args: { id: string }): Promise<StrategySyncResult> {
  const { sourceStore, strategyStore } = requireStores();
  const source = sourceStore.getById(args.id);
  if (!source) throw new Error(`Strategy source not found: ${args.id}`);

  const { strategies, errors: fetchErrors } = await fetchStrategiesFromSource(source);
  const result = await syncFromFetched(strategies, strategyStore, source);
  if (fetchErrors.length === 0 && result.failed === 0) {
    await sourceStore.updateLastSynced(source.id);
  }
  return { ...result, errors: [...fetchErrors, ...result.errors] };
}
