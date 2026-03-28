/**
 * Profile Seeder — builds asset summaries from enrichment data.
 *
 * Deterministic — no LLM calls. Composes a concise summary from
 * fundamentals.description, sector/industry, market cap, key metrics,
 * and recent filings. Summaries are stored as SUMMARY entries in
 * TickerProfile and injected into agent context via TickerProfileBrief.
 */

import type { Entity, JintelClient } from '@yojinhq/jintel-client';
import { buildBatchEnrichQuery } from '@yojinhq/jintel-client';

import type { TickerProfileStore } from './profile-store.js';
import { createSubsystemLogger } from '../logging/logger.js';

const logger = createSubsystemLogger('profile-seeder');

const SEED_ENRICH_QUERY = buildBatchEnrichQuery(['market', 'regulatory']);

export interface SeedOptions {
  /** Maximum tickers to seed per run. Default: 20 */
  batchSize?: number;
}

/**
 * Seed summaries for tickers that don't have one yet.
 * Returns the number of summaries generated.
 */
export async function seedProfileSummaries(
  tickers: string[],
  jintelClient: JintelClient,
  profileStore: TickerProfileStore,
  options?: SeedOptions,
): Promise<number> {
  const batchSize = options?.batchSize ?? 20;

  // Find tickers without a SUMMARY entry
  const needsSummary = tickers.filter((t) => {
    const entries = profileStore.getForTicker(t);
    return !entries.some((e) => e.category === 'SUMMARY');
  });

  if (needsSummary.length === 0) {
    return 0;
  }

  const toSeed = needsSummary.slice(0, batchSize);
  logger.info('Seeding profile summaries', { count: toSeed.length, total: needsSummary.length });

  const enrichmentByTicker = await batchEnrichForSeed(jintelClient, toSeed);

  let seeded = 0;
  for (const ticker of toSeed) {
    const entity = enrichmentByTicker.get(ticker);
    if (!entity) {
      logger.warn('No enrichment data for ticker, skipping summary', { ticker });
      continue;
    }

    const summary = buildAssetSummary(entity, ticker);
    if (summary) {
      await profileStore.store({
        ticker,
        category: 'SUMMARY',
        observation: summary,
        evidence: buildEvidenceSources(entity),
        insightReportId: 'seed',
        insightDate: new Date().toISOString(),
        rating: null,
        conviction: null,
        priceAtObservation: entity.market?.quote?.price ?? null,
        grade: null,
        actualReturn: null,
      });
      seeded++;
    }
  }

  if (seeded > 0) {
    logger.info('Profile seeding complete', { seeded, attempted: toSeed.length });
  }
  return seeded;
}

// ---------------------------------------------------------------------------
// Deterministic summary builder
// ---------------------------------------------------------------------------

/**
 * Build a concise asset summary from enrichment data.
 * No LLM — composes from fundamentals.description + structured fields.
 * Exported for testing.
 */
export function buildAssetSummary(entity: Entity, _ticker: string): string | null {
  const f = entity.market?.fundamentals;
  const parts: string[] = [];

  // Header: name + sector/industry
  const sectorIndustry = [f?.sector, f?.industry].filter(Boolean).join(' / ');
  const header = sectorIndustry ? `${entity.name} (${sectorIndustry})` : entity.name;
  parts.push(header);

  // Description from data source (FMP/Yahoo)
  if (f?.description) {
    // Trim to first 2 sentences for conciseness
    const sentences = f.description.match(/[^.!?]+[.!?]+/g) ?? [];
    const trimmed = sentences.slice(0, 2).join('').trim();
    if (trimmed) {
      parts.push(trimmed);
    }
  }

  // Key metrics line
  const metrics: string[] = [];
  if (f?.marketCap != null) metrics.push(`Market cap $${formatNum(f.marketCap)}`);
  if (f?.peRatio != null) metrics.push(`P/E ${f.peRatio.toFixed(1)}`);
  if (f?.dividendYield != null && f.dividendYield > 0) {
    metrics.push(`dividend yield ${(f.dividendYield * 100).toFixed(2)}%`);
  }
  if (f?.beta != null) metrics.push(`beta ${f.beta.toFixed(2)}`);
  if (f?.employees != null) metrics.push(`${f.employees.toLocaleString()} employees`);
  if (metrics.length > 0) {
    parts.push(metrics.join(', ') + '.');
  }

  // Recent filings
  const filings = entity.regulatory?.filings ?? [];
  if (filings.length > 0) {
    const recent = filings.slice(0, 2);
    const filingStr = recent.map((fil) => {
      const desc = fil.description ? ` — ${fil.description}` : '';
      return `${fil.type.replace('FILING_', '')} (${fil.date})${desc}`;
    });
    parts.push(`Recent filings: ${filingStr.join('; ')}.`);
  }

  // Need at least a name + something useful
  if (parts.length <= 1 && !f?.description) {
    return null;
  }

  return parts.join(' — ');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEvidenceSources(entity: Entity): string {
  const sources: string[] = [];
  if (entity.market?.fundamentals) sources.push('fundamentals');
  if (entity.regulatory?.filings && entity.regulatory.filings.length > 0) {
    sources.push(`${entity.regulatory.filings.length} filings`);
  }
  return `Summary from: ${sources.join(', ')}`;
}

async function batchEnrichForSeed(client: JintelClient, tickers: string[]): Promise<Map<string, Entity>> {
  const CHUNK_SIZE = 20;
  const result = new Map<string, Entity>();

  for (let i = 0; i < tickers.length; i += CHUNK_SIZE) {
    const chunk = tickers.slice(i, i + CHUNK_SIZE);
    try {
      const data = await client.request<Entity[]>(SEED_ENRICH_QUERY, { tickers: chunk });

      const entityByTicker = new Map<string, Entity>();
      for (const entity of data) {
        for (const t of entity.tickers ?? []) {
          entityByTicker.set(t.toUpperCase(), entity);
        }
      }

      for (const inputTicker of chunk) {
        const entity = entityByTicker.get(inputTicker.toUpperCase());
        if (entity) {
          result.set(inputTicker, entity);
        }
      }
    } catch (err) {
      logger.warn('Batch enrich for seed failed', { chunk, error: String(err) });
    }
  }

  return result;
}

function formatNum(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  return n.toLocaleString();
}
