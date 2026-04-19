import type { TickerPriceHistory } from '@yojinhq/jintel-client';
import { describe, expect, it } from 'vitest';

import type { Position } from '../../src/api/graphql/types.js';
import {
  buildHistoryPoints,
  buildPriceMap,
  computePortfolioTodayDelta,
  fillCalendarDays,
  resolvePositionStart,
} from '../../src/portfolio/history.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTicker(ticker: string, entries: { date: string; close: number }[]): TickerPriceHistory {
  return {
    ticker,
    history: entries.map(({ date, close }) => ({
      date,
      open: close,
      high: close,
      low: close,
      close,
      volume: 1000,
    })),
  };
}

function makePosition(
  overrides: Partial<Position> & Pick<Position, 'symbol' | 'platform' | 'quantity' | 'costBasis'>,
): Position {
  return {
    name: overrides.symbol,
    currentPrice: 0,
    marketValue: 0,
    unrealizedPnl: 0,
    unrealizedPnlPercent: 0,
    assetClass: 'EQUITY' as Position['assetClass'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildPriceMap
// ---------------------------------------------------------------------------

describe('buildPriceMap', () => {
  it('builds symbol → date → close price map from Jintel response (multi-ticker)', () => {
    const data: TickerPriceHistory[] = [
      makeTicker('AAPL', [
        { date: '2026-04-01', close: 150 },
        { date: '2026-04-02', close: 152 },
      ]),
      makeTicker('TSLA', [{ date: '2026-04-01', close: 200 }]),
    ];

    const map = buildPriceMap(data);

    expect(map.size).toBe(2);
    expect(map.get('AAPL')?.get('2026-04-01')).toBe(150);
    expect(map.get('AAPL')?.get('2026-04-02')).toBe(152);
    expect(map.get('TSLA')?.get('2026-04-01')).toBe(200);
  });

  it('returns empty map for empty input', () => {
    const map = buildPriceMap([]);
    expect(map.size).toBe(0);
  });

  it('normalizes date strings with timestamps to YYYY-MM-DD', () => {
    const data: TickerPriceHistory[] = [makeTicker('AAPL', [{ date: '2026-04-01 16:00:00', close: 150 }])];

    const map = buildPriceMap(data);
    expect(map.get('AAPL')?.get('2026-04-01')).toBe(150);
    expect(map.get('AAPL')?.has('2026-04-01 16:00:00')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// fillCalendarDays
// ---------------------------------------------------------------------------

describe('fillCalendarDays', () => {
  it('fills weekend gaps by carrying forward last close (Friday→Sat→Sun→Monday)', () => {
    // Friday=04-04, Saturday=04-05, Sunday=04-06, Monday=04-07
    const priceMap = new Map<string, Map<string, number>>([
      [
        'AAPL',
        new Map([
          ['2026-04-03', 150],
          ['2026-04-04', 152], // Friday
          // Sat/Sun missing
          ['2026-04-07', 155], // Monday
        ]),
      ],
    ]);

    const filled = fillCalendarDays(priceMap, '2026-04-03', '2026-04-07');
    const aapl = filled.get('AAPL')!;

    expect(aapl.get('2026-04-04')).toBe(152); // Friday
    expect(aapl.get('2026-04-05')).toBe(152); // Saturday — carried forward
    expect(aapl.get('2026-04-06')).toBe(152); // Sunday — carried forward
    expect(aapl.get('2026-04-07')).toBe(155); // Monday — real price
  });

  it('handles multiple symbols with different trading days', () => {
    const priceMap = new Map<string, Map<string, number>>([
      // Equity — only weekdays
      [
        'AAPL',
        new Map([
          ['2026-04-04', 152], // Friday
        ]),
      ],
      // Crypto — also has weekend
      [
        'BTC',
        new Map([
          ['2026-04-04', 80000],
          ['2026-04-05', 81000], // Saturday
          ['2026-04-06', 82000], // Sunday
        ]),
      ],
    ]);

    const filled = fillCalendarDays(priceMap, '2026-04-04', '2026-04-06');

    expect(filled.get('AAPL')?.get('2026-04-05')).toBe(152); // carried
    expect(filled.get('BTC')?.get('2026-04-05')).toBe(81000); // real
    expect(filled.get('BTC')?.get('2026-04-06')).toBe(82000); // real
  });

  it('skips days before first available price for a symbol', () => {
    const priceMap = new Map<string, Map<string, number>>([['AAPL', new Map([['2026-04-03', 150]])]]);

    const filled = fillCalendarDays(priceMap, '2026-04-01', '2026-04-03');
    const aapl = filled.get('AAPL')!;

    expect(aapl.has('2026-04-01')).toBe(false);
    expect(aapl.has('2026-04-02')).toBe(false);
    expect(aapl.get('2026-04-03')).toBe(150);
  });

  it('seeds first range-day from latest close before start', () => {
    const priceMap = new Map<string, Map<string, number>>([
      [
        'AAPL',
        new Map([
          ['2026-04-09', 149],
          ['2026-04-10', 152],
          ['2026-04-13', 155],
        ]),
      ],
    ]);

    const filled = fillCalendarDays(priceMap, '2026-04-12', '2026-04-13');
    const aapl = filled.get('AAPL')!;

    expect(aapl.get('2026-04-12')).toBe(152);
    expect(aapl.get('2026-04-13')).toBe(155);
  });

  it('produces same value on a shared date regardless of range start', () => {
    const priceMap = new Map<string, Map<string, number>>([
      [
        'AAPL',
        new Map([
          ['2026-03-19', 148],
          ['2026-03-20', 150],
          ['2026-04-10', 152],
          ['2026-04-13', 155],
        ]),
      ],
    ]);

    const filled7D = fillCalendarDays(priceMap, '2026-04-12', '2026-04-13');
    const filled1M = fillCalendarDays(priceMap, '2026-03-20', '2026-04-13');

    expect(filled7D.get('AAPL')?.get('2026-04-12')).toBe(152);
    expect(filled1M.get('AAPL')?.get('2026-04-12')).toBe(152);
  });
});

// ---------------------------------------------------------------------------
// buildHistoryPoints
// ---------------------------------------------------------------------------

describe('buildHistoryPoints', () => {
  it('computes daily totalValue from quantity × closePrice', () => {
    const positions: Position[] = [
      makePosition({ symbol: 'AAPL', platform: 'ROBINHOOD', quantity: 10, costBasis: 140 }),
    ];
    const filledPrices = new Map([
      [
        'AAPL',
        new Map([
          ['2026-04-01', 150],
          ['2026-04-02', 160],
        ]),
      ],
    ]);

    const points = buildHistoryPoints(positions, filledPrices, '2026-04-01', '2026-04-02');

    expect(points).toHaveLength(2);
    expect(points[0].totalValue).toBe(1500);
    expect(points[1].totalValue).toBe(1600);
  });

  it('computes periodPnl as value delta (cost basis constant across window)', () => {
    const positions: Position[] = [
      makePosition({ symbol: 'AAPL', platform: 'ROBINHOOD', quantity: 10, costBasis: 140 }),
    ];
    const filledPrices = new Map([
      [
        'AAPL',
        new Map([
          ['2026-04-01', 150],
          ['2026-04-02', 160],
        ]),
      ],
    ]);

    const points = buildHistoryPoints(positions, filledPrices, '2026-04-01', '2026-04-02');

    expect(points[0].periodPnl).toBe(0);
    expect(points[1].periodPnl).toBe(100);
    expect(points[1].periodPnlPercent).toBeCloseTo((100 / 1500) * 100, 5);
  });

  it('includes every position across the full window regardless of entryDate', () => {
    const positions: Position[] = [
      makePosition({
        symbol: 'AAPL',
        platform: 'ROBINHOOD',
        quantity: 10,
        costBasis: 140,
        entryDate: '2026-04-02',
        currentPrice: 160,
      }),
    ];
    const filledPrices = new Map([
      [
        'AAPL',
        new Map([
          ['2026-04-01', 150],
          ['2026-04-02', 160],
        ]),
      ],
    ]);

    const points = buildHistoryPoints(positions, filledPrices, '2026-04-01', '2026-04-02');

    expect(points[0].totalValue).toBe(1500);
    expect(points[1].totalValue).toBe(1600);
  });

  it('falls back to pos.currentPrice when Jintel has no close for a day', () => {
    const positions: Position[] = [
      makePosition({
        symbol: 'AAPL',
        platform: 'ROBINHOOD',
        quantity: 10,
        costBasis: 140,
        currentPrice: 170,
      }),
    ];
    const filledPrices = new Map([['AAPL', new Map([['2026-04-02', 150]])]]);

    const points = buildHistoryPoints(positions, filledPrices, '2026-04-01', '2026-04-02');

    expect(points[0].totalValue).toBe(1700);
    expect(points[1].totalValue).toBe(1500);
  });

  it('returns points with totalValue=0 when no prices and currentPrice=0', () => {
    const positions: Position[] = [
      makePosition({ symbol: 'AAPL', platform: 'ROBINHOOD', quantity: 10, costBasis: 140 }),
    ];
    const filledPrices = new Map<string, Map<string, number>>();

    const points = buildHistoryPoints(positions, filledPrices, '2026-04-01', '2026-04-01');

    expect(points).toHaveLength(1);
    expect(points[0].totalValue).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildHistoryPoints — cross-range consistency
// ---------------------------------------------------------------------------

describe('resolvePositionStart', () => {
  const today = '2026-04-19';

  it('uses explicit past entryDate (rule 1)', () => {
    const pos = makePosition({
      symbol: 'AAPL',
      platform: 'ROBINHOOD',
      quantity: 10,
      costBasis: 140,
      entryDate: '2026-04-10',
    });
    const firstSeen = new Map([['AAPL', '2026-04-01']]);

    expect(resolvePositionStart(pos, firstSeen, '2026-04-01', today)).toBe('2026-04-10');
  });

  it('ignores entryDate === today and falls through (rule 1 skipped)', () => {
    const pos = makePosition({
      symbol: 'AAPL',
      platform: 'ROBINHOOD',
      quantity: 10,
      costBasis: 140,
      entryDate: today,
    });
    const firstSeen = new Map([['AAPL', today]]);

    expect(resolvePositionStart(pos, firstSeen, today, today)).toBeNull();
  });

  it('gates at first-seen when symbol appears after overall-first (rule 2)', () => {
    const pos = makePosition({ symbol: 'GOOG', platform: 'ROBINHOOD', quantity: 3, costBasis: 140 });
    const firstSeen = new Map([
      ['AAPL', '2026-04-01'],
      ['GOOG', '2026-04-15'],
    ]);

    expect(resolvePositionStart(pos, firstSeen, '2026-04-01', today)).toBe('2026-04-15');
  });

  it('returns null when symbol first-seen equals overall-first (rule 3)', () => {
    const pos = makePosition({ symbol: 'AAPL', platform: 'ROBINHOOD', quantity: 10, costBasis: 140 });
    const firstSeen = new Map([['AAPL', '2026-04-01']]);

    expect(resolvePositionStart(pos, firstSeen, '2026-04-01', today)).toBeNull();
  });

  it('returns null when snapshot history is empty (first-ever import)', () => {
    const pos = makePosition({ symbol: 'AAPL', platform: 'ROBINHOOD', quantity: 10, costBasis: 140 });
    expect(resolvePositionStart(pos, new Map(), null, today)).toBeNull();
  });

  it('matches symbols case-insensitively', () => {
    const pos = makePosition({ symbol: 'goog', platform: 'ROBINHOOD', quantity: 3, costBasis: 140 });
    const firstSeen = new Map([['GOOG', '2026-04-15']]);

    expect(resolvePositionStart(pos, firstSeen, '2026-04-01', today)).toBe('2026-04-15');
  });
});

describe('buildHistoryPoints with gates', () => {
  it('excludes position on days before its gate', () => {
    const positions: Position[] = [
      makePosition({ symbol: 'AAPL', platform: 'ROBINHOOD', quantity: 10, costBasis: 140 }),
      makePosition({ symbol: 'GOOG', platform: 'ROBINHOOD', quantity: 5, costBasis: 100 }),
    ];
    const filledPrices = new Map([
      [
        'AAPL',
        new Map([
          ['2026-04-01', 150],
          ['2026-04-02', 152],
          ['2026-04-03', 155],
        ]),
      ],
      [
        'GOOG',
        new Map([
          ['2026-04-01', 200],
          ['2026-04-02', 205],
          ['2026-04-03', 210],
        ]),
      ],
    ]);
    const gates = new Map([['GOOG', '2026-04-03']]);

    const points = buildHistoryPoints(positions, filledPrices, '2026-04-01', '2026-04-03', gates);

    // Apr 1: only AAPL
    expect(points[0].totalValue).toBe(1500);
    // Apr 2: only AAPL
    expect(points[1].totalValue).toBe(1520);
    // Apr 3: AAPL + GOOG (step-up)
    expect(points[2].totalValue).toBe(1550 + 1050);
  });

  it('no gates means every position contributes every day (backwards compatible)', () => {
    const positions: Position[] = [
      makePosition({ symbol: 'AAPL', platform: 'ROBINHOOD', quantity: 10, costBasis: 140 }),
    ];
    const filledPrices = new Map([
      [
        'AAPL',
        new Map([
          ['2026-04-01', 150],
          ['2026-04-02', 160],
        ]),
      ],
    ]);

    const points = buildHistoryPoints(positions, filledPrices, '2026-04-01', '2026-04-02');

    expect(points[0].totalValue).toBe(1500);
    expect(points[1].totalValue).toBe(1600);
  });
});

describe('buildHistoryPoints cross-range consistency', () => {
  it('produces identical periodPnl on overlap days when inputs match', () => {
    const positions: Position[] = [
      makePosition({ symbol: 'AAPL', platform: 'ROBINHOOD', quantity: 10, costBasis: 140 }),
    ];
    const filledPrices = new Map([
      [
        'AAPL',
        new Map([
          ['2026-03-20', 148],
          ['2026-03-21', 149],
          ['2026-04-12', 152],
          ['2026-04-13', 153],
          ['2026-04-14', 154],
          ['2026-04-15', 155],
          ['2026-04-16', 156],
          ['2026-04-17', 158],
          ['2026-04-18', 158],
        ]),
      ],
    ]);

    const week = buildHistoryPoints(positions, filledPrices, '2026-04-12', '2026-04-18');
    const month = buildHistoryPoints(positions, filledPrices, '2026-03-20', '2026-04-18');

    const pick = (points: ReturnType<typeof buildHistoryPoints>, day: string) =>
      points.find((p) => p.timestamp.startsWith(day))!;

    for (const day of ['2026-04-17', '2026-04-18']) {
      expect(pick(week, day).periodPnl).toBeCloseTo(pick(month, day).periodPnl, 6);
      expect(pick(week, day).totalValue).toBe(pick(month, day).totalValue);
    }
  });
});

describe('computePortfolioTodayDelta', () => {
  const yesterday = '2026-04-18';
  const positions = [
    makePosition({ symbol: 'AAPL', platform: 'MANUAL', quantity: 10, costBasis: 150 }),
    makePosition({ symbol: 'GOOG', platform: 'MANUAL', quantity: 5, costBasis: 100 }),
  ];
  const filledPrices = new Map<string, Map<string, number>>([
    ['AAPL', new Map([[yesterday, 188]])],
    ['GOOG', new Map([[yesterday, 152]])],
  ]);

  it('computes delta from live value minus yesterday value', () => {
    // liveValue=2675, yesterdayValue=10*188 + 5*152 = 2640, costChange=0 → delta=35
    const delta = computePortfolioTodayDelta(
      { positions, totalValue: 2675, totalCost: 2000 },
      filledPrices,
      new Map(),
      yesterday,
    );
    expect(delta.totalDayChange).toBe(35);
    expect(delta.totalDayChangePercent).toBeCloseTo((35 / 2640) * 100, 6);
  });

  it('subtracts cost change so same-day buys do not register as gains', () => {
    // Edit mutation added $500 of cost today: totalValue bumped by $500, delta should stay 35.
    const delta = computePortfolioTodayDelta(
      { positions, totalValue: 3175, totalCost: 2500 },
      filledPrices,
      new Map(),
      yesterday,
    );
    expect(delta.totalDayChange).toBe(35);
  });

  it('gates positions whose start date is after yesterday', () => {
    const gates = new Map([['GOOG', '2026-04-19']]);
    // GOOG excluded: yesterdayValue = 10*188 = 1880; cost excluded too, yesterdayCost = 1500.
    // liveValue=2675, liveCost=2000. delta = (2675 - 1880) - (2000 - 1500) = 795 - 500 = 295.
    const delta = computePortfolioTodayDelta(
      { positions, totalValue: 2675, totalCost: 2000 },
      filledPrices,
      gates,
      yesterday,
    );
    expect(delta.totalDayChange).toBe(295);
  });

  it('falls back to currentPrice when priceData is missing for a symbol', () => {
    const withCurrent = [
      { ...positions[0], currentPrice: 190 },
      { ...positions[1], currentPrice: 155 },
    ];
    const delta = computePortfolioTodayDelta(
      { positions: withCurrent, totalValue: 2675, totalCost: 2000 },
      new Map(),
      new Map(),
      yesterday,
    );
    // yesterdayValue = 10*190 + 5*155 = 2675 → delta = 0
    expect(delta.totalDayChange).toBe(0);
    expect(delta.totalDayChangePercent).toBe(0);
  });

  it('returns 0% when yesterdayValue is 0', () => {
    const delta = computePortfolioTodayDelta(
      { positions: [], totalValue: 0, totalCost: 0 },
      filledPrices,
      new Map(),
      yesterday,
    );
    expect(delta.totalDayChange).toBe(0);
    expect(delta.totalDayChangePercent).toBe(0);
  });
});
