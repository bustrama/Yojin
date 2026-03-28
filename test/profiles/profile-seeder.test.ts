import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Entity } from '@yojinhq/jintel-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildAssetSummary, seedProfileSummaries } from '../../src/profiles/profile-seeder.js';
import { TickerProfileStore } from '../../src/profiles/profile-store.js';

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: 'aapl',
    name: 'Apple Inc.',
    type: 'COMPANY',
    tickers: ['AAPL'],
    domain: 'apple.com',
    country: 'US',
    market: {
      quote: {
        ticker: 'AAPL',
        price: 195.5,
        change: 2.3,
        changePercent: 1.19,
        volume: 45_000_000,
        timestamp: '2026-03-28T16:00:00Z',
        source: 'yahoo',
      },
      fundamentals: {
        sector: 'Technology',
        industry: 'Consumer Electronics',
        description:
          'Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories worldwide. The company offers iPhone, Mac, iPad, and wearables, home and accessories.',
        marketCap: 3_000_000_000_000,
        peRatio: 32.5,
        eps: 6.02,
        dividendYield: 0.005,
        beta: 1.25,
        employees: 164_000,
        exchange: 'NASDAQ',
        website: 'https://apple.com',
        revenue: null,
        netIncome: null,
        fiftyTwoWeekHigh: 200,
        fiftyTwoWeekLow: 150,
        debtToEquity: 1.5,
        currency: 'USD',
        source: 'fmp',
      },
    },
    regulatory: {
      sanctions: [],
      filings: [
        {
          type: 'FILING_10K',
          date: '2026-01-15',
          url: 'https://sec.gov/filing',
          description: 'Annual report for fiscal year 2025',
        },
      ],
    },
    ...overrides,
  };
}

describe('profile-seeder', () => {
  describe('buildAssetSummary', () => {
    it('includes name with sector/industry', () => {
      const summary = buildAssetSummary(makeEntity(), 'AAPL');
      expect(summary).toContain('Apple Inc. (Technology / Consumer Electronics)');
    });

    it('includes description trimmed to 2 sentences', () => {
      const summary = buildAssetSummary(makeEntity(), 'AAPL');
      expect(summary).toContain('designs, manufactures, and markets smartphones');
      // Should only have first 2 sentences
      expect(summary).not.toContain('wearables, home and accessories');
    });

    it('includes key metrics', () => {
      const summary = buildAssetSummary(makeEntity(), 'AAPL');
      expect(summary).toContain('Market cap $3.0T');
      expect(summary).toContain('P/E 32.5');
      expect(summary).toContain('beta 1.25');
      expect(summary).toContain('164,000 employees');
    });

    it('includes dividend yield when non-zero', () => {
      const summary = buildAssetSummary(makeEntity(), 'AAPL');
      expect(summary).toContain('dividend yield 0.50%');
    });

    it('excludes dividend yield when zero', () => {
      const entity = makeEntity();
      entity.market!.fundamentals!.dividendYield = 0;
      const summary = buildAssetSummary(entity, 'AAPL');
      expect(summary).not.toContain('dividend yield');
    });

    it('includes recent filings', () => {
      const summary = buildAssetSummary(makeEntity(), 'AAPL');
      expect(summary).toContain('Recent filings:');
      expect(summary).toContain('10K (2026-01-15)');
      expect(summary).toContain('Annual report for fiscal year 2025');
    });

    it('handles entity with no fundamentals but has filings', () => {
      const entity = makeEntity({ market: undefined });
      const summary = buildAssetSummary(entity, 'BTC');
      // Has filings, so still generates a summary with name + filings
      expect(summary).toContain('Apple Inc.');
      expect(summary).toContain('Recent filings:');
    });

    it('returns null when entity has no useful data', () => {
      const entity = makeEntity({ market: undefined, regulatory: { sanctions: [], filings: [] } });
      const summary = buildAssetSummary(entity, 'BTC');
      expect(summary).toBeNull();
    });

    it('handles entity with only a name and sector', () => {
      const entity = makeEntity();
      entity.market!.fundamentals!.description = undefined;
      entity.market!.fundamentals!.marketCap = undefined;
      entity.market!.fundamentals!.peRatio = undefined;
      entity.market!.fundamentals!.dividendYield = undefined;
      entity.market!.fundamentals!.beta = undefined;
      entity.market!.fundamentals!.employees = undefined;
      entity.regulatory = { sanctions: [], filings: [] };
      // Still has sector/industry, so header is useful
      const summary = buildAssetSummary(entity, 'AAPL');
      expect(summary).toBeNull(); // Just a header isn't enough
    });

    it('handles entity with description but no metrics', () => {
      const entity = makeEntity();
      entity.market!.fundamentals!.marketCap = undefined;
      entity.market!.fundamentals!.peRatio = undefined;
      entity.market!.fundamentals!.dividendYield = undefined;
      entity.market!.fundamentals!.beta = undefined;
      entity.market!.fundamentals!.employees = undefined;
      entity.regulatory = { sanctions: [], filings: [] };
      const summary = buildAssetSummary(entity, 'AAPL');
      expect(summary).not.toBeNull();
      expect(summary).toContain('Apple Inc. (Technology / Consumer Electronics)');
      expect(summary).toContain('designs, manufactures');
    });

    it('handles entity with no sector/industry', () => {
      const entity = makeEntity();
      entity.market!.fundamentals!.sector = undefined;
      entity.market!.fundamentals!.industry = undefined;
      const summary = buildAssetSummary(entity, 'BTC');
      expect(summary).toContain('Apple Inc.');
      // No "(Technology / Consumer Electronics)" header
      expect(summary).not.toContain('Technology');
    });
  });

  describe('seedProfileSummaries', () => {
    let dir: string;
    let store: TickerProfileStore;

    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), 'seeder-'));
      store = new TickerProfileStore({ dataDir: dir });
      await store.initialize();
    });

    afterEach(async () => {
      await rm(dir, { recursive: true, force: true });
    });

    it('seeds summaries for tickers without one', async () => {
      const entity = makeEntity();
      const mockClient = {
        request: vi.fn().mockResolvedValue([entity]),
      };

      const seeded = await seedProfileSummaries(['AAPL'], mockClient as never, store);

      expect(seeded).toBe(1);
      const entries = store.getForTicker('AAPL');
      expect(entries).toHaveLength(1);
      expect(entries[0].category).toBe('SUMMARY');
      expect(entries[0].observation).toContain('Apple Inc.');
      expect(entries[0].evidence).toContain('Summary from:');
    });

    it('skips tickers that already have a summary', async () => {
      await store.store({
        ticker: 'AAPL',
        category: 'SUMMARY',
        observation: 'Existing summary',
        evidence: 'manual',
        insightReportId: 'seed',
        insightDate: '2026-03-20T00:00:00.000Z',
        rating: null,
        conviction: null,
        priceAtObservation: null,
        grade: null,
        actualReturn: null,
      });

      const mockClient = { request: vi.fn() };
      const seeded = await seedProfileSummaries(['AAPL'], mockClient as never, store);

      expect(seeded).toBe(0);
      expect(mockClient.request).not.toHaveBeenCalled();
    });

    it('respects batchSize option', async () => {
      const entities = ['AAPL', 'MSFT', 'GOOG'].map((t) => makeEntity({ id: t.toLowerCase(), name: t, tickers: [t] }));
      const mockClient = {
        request: vi.fn().mockResolvedValue(entities),
      };

      const seeded = await seedProfileSummaries(['AAPL', 'MSFT', 'GOOG'], mockClient as never, store, {
        batchSize: 2,
      });

      expect(seeded).toBe(2);
    });

    it('stores price at observation from quote', async () => {
      const entity = makeEntity();
      const mockClient = {
        request: vi.fn().mockResolvedValue([entity]),
      };

      await seedProfileSummaries(['AAPL'], mockClient as never, store);

      const entries = store.getForTicker('AAPL');
      expect(entries[0].priceAtObservation).toBe(195.5);
    });

    it('summary appears in buildBrief', async () => {
      const entity = makeEntity();
      const mockClient = {
        request: vi.fn().mockResolvedValue([entity]),
      };

      await seedProfileSummaries(['AAPL'], mockClient as never, store);

      const brief = store.buildBrief('AAPL');
      expect(brief.summary).toContain('Apple Inc.');
      expect(brief.entryCount).toBe(1);
    });
  });
});
