import { parseFromMarkdown } from './strategy-serializer.js';
import { fetchStrategiesFromSource } from './strategy-source-fetcher.js';
import type { FetchedStrategy } from './strategy-source-fetcher.js';
import type { StrategySourceStore } from './strategy-source-store.js';
import type { StrategySource } from './strategy-source-types.js';
import { DEFAULT_SOURCE_ID } from './strategy-source-types.js';
import type { StrategyStore } from './strategy-store.js';
import { createSubsystemLogger } from '../logging/logger.js';

const logger = createSubsystemLogger('strategy-source-sync');

export interface StrategySyncResult {
  added: number;
  skipped: number;
  failed: number;
  errors: string[];
}

/**
 * Sync strategies from pre-fetched markdown into the strategy store.
 * Skips strategies whose ID already exists.
 */
export async function syncFromFetched(
  fetched: FetchedStrategy[],
  strategyStore: StrategyStore,
  source: StrategySource,
): Promise<StrategySyncResult> {
  const result: StrategySyncResult = { added: 0, skipped: 0, failed: 0, errors: [] };
  const isDefault = source.id === DEFAULT_SOURCE_ID;

  for (const { filename, markdown } of fetched) {
    try {
      const parsed = parseFromMarkdown(markdown);
      const strategySource: 'built-in' | 'community' = isDefault ? 'built-in' : 'community';
      const strategy = { ...parsed, source: strategySource, createdBy: source.id };

      if (strategyStore.getById(strategy.id)) {
        result.skipped++;
        continue;
      }

      strategyStore.save(strategy);
      result.added++;
    } catch (err) {
      result.failed++;
      result.errors.push(`${filename}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  logger.info(`Sync from ${source.id}: added=${result.added} skipped=${result.skipped} failed=${result.failed}`);
  return result;
}

/**
 * Sync strategies from all provided sources: fetch from GitHub, parse, save new ones.
 */
export async function syncStrategies(
  sources: StrategySource[],
  strategyStore: StrategyStore,
  sourceStore?: StrategySourceStore,
): Promise<StrategySyncResult> {
  const totalResult: StrategySyncResult = { added: 0, skipped: 0, failed: 0, errors: [] };

  const fetchResults = await Promise.allSettled(
    sources.map(async (source) => ({
      source,
      ...(await fetchStrategiesFromSource(source)),
    })),
  );

  for (const fetchResult of fetchResults) {
    if (fetchResult.status === 'rejected') {
      totalResult.errors.push(
        fetchResult.reason instanceof Error ? fetchResult.reason.message : String(fetchResult.reason),
      );
      continue;
    }

    const { source, strategies: fetched, errors: fetchErrors } = fetchResult.value;
    totalResult.errors.push(...fetchErrors);

    const result = await syncFromFetched(fetched, strategyStore, source);
    totalResult.added += result.added;
    totalResult.skipped += result.skipped;
    totalResult.failed += result.failed;
    totalResult.errors.push(...result.errors);

    if (fetchErrors.length === 0 && result.failed === 0) {
      await sourceStore?.updateLastSynced(source.id);
    }
  }

  return totalResult;
}
