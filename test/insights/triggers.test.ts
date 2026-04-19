import type { Entity } from '@yojinhq/jintel-client';
import { describe, expect, it } from 'vitest';

import type { DataBrief } from '../../src/insights/data-gatherer.js';
import {
  TRIGGER_BUDGET_PER_CYCLE,
  evaluateTriggers,
  selectBudgeted,
  totalSeverity,
  unionFields,
} from '../../src/insights/triggers.js';
import type { TriggerHit } from '../../src/insights/triggers.js';

function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();
}

function makeBrief(overrides: Partial<DataBrief> = {}): DataBrief {
  return {
    symbol: 'TEST',
    name: 'Test Co',
    quantity: 10,
    costBasis: 100,
    currentPrice: 100,
    marketValue: 1000,
    unrealizedPnlPercent: 0,
    sector: null,
    assetClass: 'equity',
    quotePrice: 100,
    changePercent: 0,
    volume: null,
    description: null,
    marketCap: null,
    pe: null,
    eps: null,
    beta: null,
    dividendYield: null,
    debtToEquity: null,
    fiftyTwoWeekHigh: null,
    fiftyTwoWeekLow: null,
    enrichmentSector: null,
    enrichmentIndustry: null,
    riskScore: null,
    riskSignals: [],
    recentFilings: [],
    technicals: null,
    socialSentiment: null,
    signalCount: 0,
    signals: [],
    sentimentDirection: 'NEUTRAL',
    memories: [],
    newsArticles: [],
    researchReports: [],
    institutionalHoldings: [],
    ownership: null,
    topHolders: [],
    insiderTrades: null,
    earningsPressRelease: null,
    profile: null,
    ...overrides,
  } as DataBrief;
}

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    tickers: ['TEST'],
    ...overrides,
  } as Entity;
}

describe('evaluateTriggers', () => {
  it('returns empty when nothing fires', () => {
    expect(evaluateTriggers(makeBrief(), makeEntity())).toEqual([]);
  });

  it('T1 fires for earnings within 7d', () => {
    const entity = makeEntity({
      market: { fundamentals: { earningsDate: daysFromNow(2) } },
    } as Partial<Entity>);
    const hits = evaluateTriggers(makeBrief(), entity);
    const t1 = hits.find((h) => h.id === 'T1');
    expect(t1).toBeDefined();
    expect(t1?.fields).toEqual(['earnings']);
    expect(t1?.severity).toBeGreaterThanOrEqual(0.7);
  });

  it('T1 does not fire when earnings is too far out', () => {
    const entity = makeEntity({
      market: { fundamentals: { earningsDate: daysFromNow(30) } },
    } as Partial<Entity>);
    expect(evaluateTriggers(makeBrief(), entity).some((h) => h.id === 'T1')).toBe(false);
  });

  it('T2 fires for |surprisePercent| >= 10', () => {
    const entity = makeEntity({
      market: {
        fundamentals: {
          earningsHistory: [{ surprisePercent: 15, date: '2026-02-01' }],
        },
      },
    } as Partial<Entity>);
    const hits = evaluateTriggers(makeBrief(), entity);
    const t2 = hits.find((h) => h.id === 'T2');
    expect(t2).toBeDefined();
    expect(t2?.fields).toContain('segmentedRevenue');
    expect(t2?.fields).toContain('financials');
  });

  it('T3 fires on social rank spike', () => {
    const brief = makeBrief({
      socialSentiment: { rank: 5, rank24hAgo: 50, mentions: 100, mentions24hAgo: 100, upvotes: 0 },
    });
    const hits = evaluateTriggers(brief, makeEntity());
    expect(hits.find((h) => h.id === 'T3')).toBeDefined();
  });

  it('T4 fires on analyst PT gap vs current price', () => {
    const brief = makeBrief({ quotePrice: 100, currentPrice: 100 });
    const entity = makeEntity({
      analyst: { targetMean: 130, numberOfAnalysts: 10 },
    } as Partial<Entity>);
    const hits = evaluateTriggers(brief, entity);
    const t4 = hits.find((h) => h.id === 'T4');
    expect(t4).toBeDefined();
    expect(t4?.fields).toEqual([]); // focus-only
  });

  it('T4 suppressed when analyst coverage is thin', () => {
    const brief = makeBrief({ quotePrice: 100 });
    const entity = makeEntity({
      analyst: { targetMean: 200, numberOfAnalysts: 2 },
    } as Partial<Entity>);
    expect(evaluateTriggers(brief, entity).some((h) => h.id === 'T4')).toBe(false);
  });

  it('T5 fires on >= 5% absolute move when ATR is unavailable', () => {
    const brief = makeBrief({ changePercent: 6.5, quotePrice: 100, currentPrice: 100 });
    const hits = evaluateTriggers(brief, makeEntity());
    const t5 = hits.find((h) => h.id === 'T5');
    expect(t5).toBeDefined();
    expect(t5?.fields).toEqual(['derivatives']);
  });

  it('T5 fires above 2×ATR% when ATR is available', () => {
    const brief = makeBrief({
      changePercent: 3.5, // 3.5% move
      quotePrice: 100,
      currentPrice: 100,
      // ATR 1 on $100 price = 1% ATR; 2×ATR = 2% → 3.5% move fires
      technicals: {
        rsi: null,
        macd: null,
        bollingerBands: null,
        bollingerBandsWidth: null,
        ema: null,
        ema50: null,
        ema200: null,
        sma: null,
        sma20: null,
        sma200: null,
        wma52: null,
        atr: 1,
        vwma: null,
        vwap: null,
        mfi: null,
        adx: null,
        stochastic: null,
        obv: null,
        parabolicSar: null,
        williamsR: null,
        crossovers: null,
      },
    });
    expect(evaluateTriggers(brief, makeEntity()).some((h) => h.id === 'T5')).toBe(true);
  });

  it('T6 fires for a recent material filing', () => {
    const entity = makeEntity({
      regulatory: {
        filings: [{ type: 'FILING_8K', date: daysFromNow(-1), description: null, url: '' }],
      },
    } as Partial<Entity>);
    const hits = evaluateTriggers(makeBrief(), entity);
    expect(hits.find((h) => h.id === 'T6')?.fields).toEqual(['periodicFilings']);
  });

  it('T7 fires on recent HIGH severity risk signal', () => {
    const entity = makeEntity({
      risk: {
        signals: [{ severity: 'HIGH', date: daysFromNow(-2), title: 'x', source: 'internal', url: null }],
      },
    } as Partial<Entity>);
    expect(evaluateTriggers(makeBrief(), entity).some((h) => h.id === 'T7')).toBe(true);
  });

  it('T8 fires when short interest >= 15% of float', () => {
    const brief = makeBrief({
      ownership: {
        insiderOwnership: null,
        institutionOwnership: null,
        institutionsCount: null,
        outstandingShares: null,
        floatShares: null,
        shortPercentOfFloat: 0.2,
        shortInterestDate: '2026-03-01',
      },
    });
    expect(evaluateTriggers(brief, makeEntity()).some((h) => h.id === 'T8')).toBe(true);
  });

  it('T9 fires on cluster insider buying', () => {
    const brief = makeBrief({
      insiderTrades: {
        windowDays: 30,
        buyCount: 4,
        sellCount: 0,
        buyValue: 500_000,
        sellValue: 0,
        plannedCount: 0,
        latestFilingDate: '2026-03-10',
        topTrades: [],
      },
    });
    const hits = evaluateTriggers(brief, makeEntity());
    expect(hits.find((h) => h.id === 'T9')).toBeDefined();
  });
});

describe('unionFields', () => {
  it('dedupes fields across hits', () => {
    const hits: TriggerHit[] = [
      { id: 'T5', severity: 0.5, reason: 'x', fields: ['derivatives'] },
      { id: 'T8', severity: 0.5, reason: 'y', fields: ['derivatives'] },
      { id: 'T1', severity: 0.5, reason: 'z', fields: ['earnings'] },
    ];
    expect(unionFields(hits).sort()).toEqual(['derivatives', 'earnings']);
  });

  it('drops focus-only hits with empty fields', () => {
    const hits: TriggerHit[] = [{ id: 'T4', severity: 0.5, reason: 'x', fields: [] }];
    expect(unionFields(hits)).toEqual([]);
  });
});

describe('selectBudgeted', () => {
  it('keeps top N by total severity', () => {
    const map = new Map<string, TriggerHit[]>([
      ['LOW', [{ id: 'T1', severity: 0.1, reason: '', fields: [] }]],
      ['HIGH', [{ id: 'T1', severity: 0.9, reason: '', fields: [] }]],
      ['MID', [{ id: 'T1', severity: 0.5, reason: '', fields: [] }]],
    ]);
    const picked = selectBudgeted(map, 2);
    expect([...picked.keys()]).toEqual(['HIGH', 'MID']);
  });

  it('drops tickers with no hits', () => {
    const map = new Map<string, TriggerHit[]>([
      ['A', []],
      ['B', [{ id: 'T1', severity: 0.5, reason: '', fields: [] }]],
    ]);
    expect([...selectBudgeted(map).keys()]).toEqual(['B']);
  });

  it('defaults to TRIGGER_BUDGET_PER_CYCLE', () => {
    const entries: Array<[string, TriggerHit[]]> = [];
    for (let i = 0; i < 20; i++) {
      entries.push([`T${i}`, [{ id: 'T1', severity: i / 20, reason: '', fields: [] }]]);
    }
    const picked = selectBudgeted(new Map(entries));
    expect(picked.size).toBe(TRIGGER_BUDGET_PER_CYCLE);
  });
});

describe('totalSeverity', () => {
  it('sums severities', () => {
    const hits: TriggerHit[] = [
      { id: 'T1', severity: 0.3, reason: '', fields: [] },
      { id: 'T2', severity: 0.6, reason: '', fields: [] },
    ];
    expect(totalSeverity(hits)).toBeCloseTo(0.9);
  });
});
