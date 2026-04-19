import type { JintelClient, TickerPriceHistory } from '@yojinhq/jintel-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  portfolioHistoryQuery,
  setPortfolioJintelClient,
  setSnapshotStore,
} from '../../../../src/api/graphql/resolvers/portfolio.js';
import type { PortfolioSnapshot } from '../../../../src/api/graphql/types.js';
import { clearLiveEnrichmentCache } from '../../../../src/portfolio/live-enrichment.js';
import type { PortfolioSnapshotStore } from '../../../../src/portfolio/snapshot-store.js';

function makeSnapshot(positions: PortfolioSnapshot['positions']): PortfolioSnapshot {
  const totalValue = positions.reduce((s, p) => s + p.marketValue, 0);
  const totalCost = positions.reduce((s, p) => s + p.costBasis * p.quantity, 0);
  return {
    id: 'snap-test',
    positions,
    totalValue,
    totalCost,
    totalPnl: totalValue - totalCost,
    totalPnlPercent: totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0,
    totalDayChange: 0,
    totalDayChangePercent: 0,
    timestamp: new Date().toISOString(),
    platform: null,
  };
}

function makePriceHistory(ticker: string, prices: Record<string, number>): TickerPriceHistory {
  return {
    ticker,
    history: Object.entries(prices).map(([date, close]) => ({
      date,
      open: close,
      high: close,
      low: close,
      close,
      volume: 1000,
    })),
  };
}

function createMockJintel(priceHistories: TickerPriceHistory[]): JintelClient {
  return {
    priceHistory: vi.fn().mockResolvedValue({ success: true, data: priceHistories }),
    quotes: vi.fn().mockResolvedValue({ success: false, error: 'not needed' }),
  } as unknown as JintelClient;
}

function createMockStore(snapshot: PortfolioSnapshot): PortfolioSnapshotStore {
  const snapshotDay = snapshot.timestamp.slice(0, 10);
  const firstSeenBySymbol = new Map<string, string>(snapshot.positions.map((p) => [p.symbol, snapshotDay]));
  return {
    getLatest: vi.fn().mockResolvedValue(snapshot),
    getFirstSeenMap: vi.fn().mockResolvedValue({
      firstSeenBySymbol,
      overallFirstDate: snapshot.positions.length > 0 ? snapshotDay : null,
    }),
    save: vi.fn(),
  } as unknown as PortfolioSnapshotStore;
}

describe('portfolioHistoryQuery — backfill from Jintel prices', () => {
  beforeEach(() => {
    clearLiveEnrichmentCache();
    setPortfolioJintelClient(undefined);
  });

  it('returns empty when no jintel client', async () => {
    const snap = makeSnapshot([
      {
        symbol: 'AAPL',
        name: 'Apple',
        quantity: 10,
        costBasis: 150,
        currentPrice: 200,
        marketValue: 2000,
        unrealizedPnl: 500,
        unrealizedPnlPercent: 33.33,
        assetClass: 'EQUITY',
        platform: 'MANUAL',
        entryDate: '2026-04-01',
      },
    ]);
    setSnapshotStore(createMockStore(snap));
    setPortfolioJintelClient(undefined);

    const history = await portfolioHistoryQuery(7);
    expect(history).toEqual([]);
  });

  it('computes history points from Jintel daily prices', async () => {
    // Use recent dates relative to now so they fall within the 7-day window
    const today = new Date();
    const d = (offset: number) => {
      const date = new Date(today.getTime() - offset * 24 * 60 * 60 * 1000);
      return date.toISOString().slice(0, 10);
    };
    const day3ago = d(3);
    const day2ago = d(2);
    const day1ago = d(1);

    const snap = makeSnapshot([
      {
        symbol: 'AAPL',
        name: 'Apple',
        quantity: 10,
        costBasis: 150,
        currentPrice: 200,
        marketValue: 2000,
        unrealizedPnl: 500,
        unrealizedPnlPercent: 33.33,
        assetClass: 'EQUITY',
        platform: 'MANUAL',
        entryDate: day3ago,
      },
    ]);
    const prices = makePriceHistory('AAPL', {
      [day3ago]: 200,
      [day2ago]: 210,
      [day1ago]: 205,
    });
    setSnapshotStore(createMockStore(snap));
    setPortfolioJintelClient(createMockJintel([prices]));

    const history = await portfolioHistoryQuery(7);

    // Historical points + today's live point
    expect(history.length).toBeGreaterThanOrEqual(4);
    // Check specific historical day values
    const point3ago = history.find((p) => p.timestamp.slice(0, 10) === day3ago);
    const point2ago = history.find((p) => p.timestamp.slice(0, 10) === day2ago);
    const point1ago = history.find((p) => p.timestamp.slice(0, 10) === day1ago);
    expect(point3ago?.totalValue).toBe(2000); // 10 × 200
    expect(point2ago?.totalValue).toBe(2100); // 10 × 210
    expect(point1ago?.totalValue).toBe(2050); // 10 × 205
  });

  it('returns empty when no positions', async () => {
    const snap = makeSnapshot([]);
    setSnapshotStore(createMockStore(snap));
    setPortfolioJintelClient(createMockJintel([]));

    const history = await portfolioHistoryQuery(7);
    expect(history).toEqual([]);
  });

  it('returns empty when Jintel fails', async () => {
    const snap = makeSnapshot([
      {
        symbol: 'AAPL',
        name: 'Apple',
        quantity: 10,
        costBasis: 150,
        currentPrice: 200,
        marketValue: 2000,
        unrealizedPnl: 500,
        unrealizedPnlPercent: 33.33,
        assetClass: 'EQUITY',
        platform: 'MANUAL',
        entryDate: '2026-04-01',
      },
    ]);
    const failClient = {
      priceHistory: vi.fn().mockResolvedValue({ success: false, error: 'API down' }),
      quotes: vi.fn().mockResolvedValue({ success: false }),
    } as unknown as JintelClient;

    setSnapshotStore(createMockStore(snap));
    setPortfolioJintelClient(failClient);

    const history = await portfolioHistoryQuery(7);
    expect(history).toEqual([]);
  });

  it('live-point periodPnl equals totalValue delta from last historical point', async () => {
    const today = new Date();
    const d = (offset: number) => {
      const date = new Date(today.getTime() - offset * 24 * 60 * 60 * 1000);
      return date.toISOString().slice(0, 10);
    };
    const day1ago = d(1);

    const snap = makeSnapshot([
      {
        symbol: 'AAPL',
        name: 'Apple',
        quantity: 10,
        costBasis: 150,
        currentPrice: 200,
        marketValue: 2000,
        unrealizedPnl: 500,
        unrealizedPnlPercent: 33.33,
        assetClass: 'EQUITY',
        platform: 'MANUAL',
        entryDate: day1ago,
      },
    ]);
    const prices = makePriceHistory('AAPL', { [day1ago]: 205 });

    // Live quote: price 210 (up from yesterday's 205), but dayChange reports -3
    const mockClient = {
      priceHistory: vi.fn().mockResolvedValue({ success: true, data: [prices] }),
      quotes: vi.fn().mockResolvedValue({
        success: true,
        data: [{ ticker: 'AAPL', price: 210, change: -3, changePercent: -1.4, volume: 0, timestamp: '' }],
      }),
    } as unknown as JintelClient;

    setSnapshotStore(createMockStore(snap));
    setPortfolioJintelClient(mockClient);

    const history = await portfolioHistoryQuery(7);
    const live = history[history.length - 1];
    const prev = history[history.length - 2];

    // Live periodPnl tracks totalValue delta (10×210 − 10×205 = 50), NOT dayChange (−30)
    expect(live.totalValue - prev.totalValue).toBe(50);
    expect(live.periodPnl).toBe(50);
    expect(Math.sign(live.periodPnl)).toBe(Math.sign(live.totalValue - prev.totalValue));
  });

  it('gates new-addition symbols out of days before their first-seen', async () => {
    const today = new Date();
    const d = (offset: number) => {
      const date = new Date(today.getTime() - offset * 24 * 60 * 60 * 1000);
      return date.toISOString().slice(0, 10);
    };
    const day5ago = d(5);
    const day2ago = d(2);
    const day1ago = d(1);

    const snap = makeSnapshot([
      {
        symbol: 'AAPL',
        name: 'Apple',
        quantity: 10,
        costBasis: 150,
        currentPrice: 200,
        marketValue: 2000,
        unrealizedPnl: 500,
        unrealizedPnlPercent: 33.33,
        assetClass: 'EQUITY',
        platform: 'ROBINHOOD',
      },
      {
        symbol: 'GOOG',
        name: 'Alphabet',
        quantity: 5,
        costBasis: 100,
        currentPrice: 120,
        marketValue: 600,
        unrealizedPnl: 100,
        unrealizedPnlPercent: 20,
        assetClass: 'EQUITY',
        platform: 'ROBINHOOD',
      },
    ]);
    const prices = [
      makePriceHistory('AAPL', { [day5ago]: 200, [day2ago]: 200, [day1ago]: 200 }),
      makePriceHistory('GOOG', { [day5ago]: 120, [day2ago]: 120, [day1ago]: 120 }),
    ];

    const storeMock = {
      getLatest: vi.fn().mockResolvedValue(snap),
      // AAPL held since the first snapshot; GOOG first seen only 1 day ago (genuine new addition).
      getFirstSeenMap: vi.fn().mockResolvedValue({
        firstSeenBySymbol: new Map([
          ['AAPL', day5ago],
          ['GOOG', day1ago],
        ]),
        overallFirstDate: day5ago,
      }),
      save: vi.fn(),
    } as unknown as PortfolioSnapshotStore;

    setSnapshotStore(storeMock);
    setPortfolioJintelClient(createMockJintel(prices));

    const history = await portfolioHistoryQuery(7);

    const point2ago = history.find((p) => p.timestamp.slice(0, 10) === day2ago);
    const point1ago = history.find((p) => p.timestamp.slice(0, 10) === day1ago);

    // 2 days ago: only AAPL contributes (GOOG gated out until day1ago).
    expect(point2ago?.totalValue).toBe(2000);
    // 1 day ago: both contribute — visible step-up on GOOG's entry day.
    expect(point1ago?.totalValue).toBe(2000 + 600);
  });

  it('includes positions in history even without entryDate', async () => {
    const today = new Date();
    const d = (offset: number) => {
      const date = new Date(today.getTime() - offset * 24 * 60 * 60 * 1000);
      return date.toISOString().slice(0, 10);
    };
    const day2ago = d(2);

    const snap = makeSnapshot([
      {
        symbol: 'AAPL',
        name: 'Apple',
        quantity: 10,
        costBasis: 150,
        currentPrice: 200,
        marketValue: 2000,
        unrealizedPnl: 500,
        unrealizedPnlPercent: 33.33,
        assetClass: 'EQUITY',
        platform: 'ROBINHOOD',
      },
    ]);
    const prices = makePriceHistory('AAPL', { [day2ago]: 210 });

    setSnapshotStore(createMockStore(snap));
    setPortfolioJintelClient(createMockJintel([prices]));

    const history = await portfolioHistoryQuery(7);

    const point2ago = history.find((p) => p.timestamp.slice(0, 10) === day2ago);
    expect(point2ago?.totalValue).toBe(2100);
  });
});
