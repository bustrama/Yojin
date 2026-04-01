import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PortfolioSnapshotStore } from '../../src/portfolio/snapshot-store.js';
import { SignalArchive } from '../../src/signals/archive.js';
import { CuratedSignalStore } from '../../src/signals/curation/curated-signal-store.js';
import { runCurationPipeline } from '../../src/signals/curation/pipeline.js';
import { CuratedSignalSchema, CurationConfigSchema } from '../../src/signals/curation/types.js';
import type { CurationConfig } from '../../src/signals/curation/types.js';
import type { Signal } from '../../src/signals/types.js';
import type { WatchlistEntry } from '../../src/watchlist/types.js';

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: 'sig-001',
    contentHash: 'hash-001',
    type: 'NEWS',
    title: 'Apple Q4 earnings beat expectations',
    assets: [{ ticker: 'AAPL', relevance: 0.9, linkType: 'DIRECT' }],
    sources: [{ id: 'reuters', name: 'Reuters', type: 'RSS', reliability: 0.8 }],
    publishedAt: new Date().toISOString(),
    ingestedAt: new Date().toISOString(),
    confidence: 0.85,
    outputType: 'INSIGHT',
    version: 1,
    ...overrides,
  };
}

function makeWatchlistEntry(symbol: string): WatchlistEntry {
  return {
    symbol: symbol.toUpperCase(),
    name: `${symbol} Inc.`,
    assetClass: 'EQUITY',
    addedAt: new Date().toISOString(),
  };
}

describe('feedTarget', () => {
  describe('CuratedSignalSchema', () => {
    it('defaults feedTarget to PORTFOLIO when not provided', () => {
      const raw = {
        signal: makeSignal(),
        scores: [{ signalId: 'sig-001', ticker: 'AAPL', exposureWeight: 0.3, typeRelevance: 0.7, compositeScore: 0.5 }],
        curatedAt: new Date().toISOString(),
      };
      const parsed = CuratedSignalSchema.parse(raw);
      expect(parsed.feedTarget).toBe('PORTFOLIO');
    });

    it('preserves explicit feedTarget', () => {
      const raw = {
        signal: makeSignal(),
        scores: [{ signalId: 'sig-001', ticker: 'AAPL', exposureWeight: 0, typeRelevance: 0.7, compositeScore: 0.4 }],
        curatedAt: new Date().toISOString(),
        feedTarget: 'WATCHLIST',
      };
      const parsed = CuratedSignalSchema.parse(raw);
      expect(parsed.feedTarget).toBe('WATCHLIST');
    });
  });

  describe('pipeline watchlist pass', () => {
    let dataRoot: string;
    let signalArchive: SignalArchive;
    let curatedStore: CuratedSignalStore;
    let snapshotStore: PortfolioSnapshotStore;
    let config: CurationConfig;

    beforeEach(async () => {
      dataRoot = await mkdtemp(join(tmpdir(), 'yojin-feedtarget-'));
      const signalDir = join(dataRoot, 'signals', 'by-date');
      await mkdir(signalDir, { recursive: true });
      signalArchive = new SignalArchive({ dir: signalDir });
      curatedStore = new CuratedSignalStore(dataRoot);
      snapshotStore = new PortfolioSnapshotStore(dataRoot);
      config = CurationConfigSchema.parse({});
    });

    afterEach(async () => {
      await rm(dataRoot, { recursive: true, force: true });
    });

    async function seedPortfolio(): Promise<void> {
      await snapshotStore.save({
        positions: [
          {
            symbol: 'AAPL',
            name: 'Apple Inc.',
            quantity: 10,
            costBasis: 1500,
            currentPrice: 180,
            marketValue: 1800,
            unrealizedPnl: 300,
            unrealizedPnlPercent: 20,
            assetClass: 'EQUITY',
            platform: 'MANUAL',
          },
        ],
        platform: 'MANUAL',
      });
    }

    it('tags portfolio signals with PORTFOLIO feedTarget', async () => {
      await seedPortfolio();
      await signalArchive.appendBatch([makeSignal({ id: 's1', contentHash: 'h1', title: 'AAPL beat' })]);

      await runCurationPipeline({ signalArchive, curatedStore, snapshotStore, config });
      const curated = await curatedStore.queryByTickers(['AAPL']);
      expect(curated).toHaveLength(1);
      expect(curated[0].feedTarget).toBe('PORTFOLIO');
    });

    it('curates watchlist signals with groupId and tags WATCHLIST', async () => {
      await seedPortfolio();
      await signalArchive.appendBatch([
        makeSignal({
          id: 's1',
          contentHash: 'h1',
          title: 'NVDA earnings chain signal',
          assets: [{ ticker: 'NVDA', relevance: 0.9, linkType: 'DIRECT' }],
          groupId: 'grp-001',
        }),
      ]);

      const watchlist = [makeWatchlistEntry('NVDA')];
      const result = await runCurationPipeline({
        signalArchive,
        curatedStore,
        snapshotStore,
        config,
        watchlistEntries: watchlist,
      });

      expect(result.signalsCurated).toBeGreaterThanOrEqual(1);
      const curated = await curatedStore.queryByTickers(['NVDA']);
      expect(curated).toHaveLength(1);
      expect(curated[0].feedTarget).toBe('WATCHLIST');
      expect(curated[0].scores[0].exposureWeight).toBe(0);
    });

    it('filters out watchlist signals without groupId', async () => {
      await seedPortfolio();
      await signalArchive.appendBatch([
        makeSignal({
          id: 's1',
          contentHash: 'h1',
          title: 'NVDA routine news',
          assets: [{ ticker: 'NVDA', relevance: 0.9, linkType: 'DIRECT' }],
          // no groupId — should be filtered
        }),
      ]);

      const watchlist = [makeWatchlistEntry('NVDA')];
      await runCurationPipeline({
        signalArchive,
        curatedStore,
        snapshotStore,
        config,
        watchlistEntries: watchlist,
      });

      const curated = await curatedStore.queryByTickers(['NVDA']);
      expect(curated).toHaveLength(0);
    });

    it('excludes portfolio tickers from watchlist pass', async () => {
      await seedPortfolio();
      await signalArchive.appendBatch([
        makeSignal({
          id: 's1',
          contentHash: 'h1',
          title: 'AAPL grouped signal',
          assets: [{ ticker: 'AAPL', relevance: 0.9, linkType: 'DIRECT' }],
          groupId: 'grp-001',
        }),
      ]);

      // AAPL is in both portfolio and watchlist — should only appear as PORTFOLIO
      const watchlist = [makeWatchlistEntry('AAPL')];
      await runCurationPipeline({
        signalArchive,
        curatedStore,
        snapshotStore,
        config,
        watchlistEntries: watchlist,
      });

      const curated = await curatedStore.queryByTickers(['AAPL']);
      expect(curated).toHaveLength(1);
      expect(curated[0].feedTarget).toBe('PORTFOLIO');
    });

    it('runs without watchlist when watchlistEntries not provided', async () => {
      await seedPortfolio();
      await signalArchive.appendBatch([makeSignal({ id: 's1', contentHash: 'h1', title: 'AAPL beat' })]);

      const result = await runCurationPipeline({ signalArchive, curatedStore, snapshotStore, config });
      expect(result.signalsCurated).toBe(1);
    });
  });
});
