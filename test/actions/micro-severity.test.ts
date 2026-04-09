/**
 * Micro severity helper tests — the scoring function that gates whether
 * a micro observation should be promoted to an Action.
 */

import { describe, expect, it } from 'vitest';

import { computeMicroActionSeverity, microActionSource } from '../../src/actions/micro-severity.js';

describe('computeMicroActionSeverity', () => {
  it('scores VERY_BULLISH at full multiplier', () => {
    const score = computeMicroActionSeverity({ rating: 'VERY_BULLISH', conviction: 0.9 });
    expect(score).toBeCloseTo(0.9, 5);
  });

  it('scores VERY_BEARISH at full multiplier', () => {
    const score = computeMicroActionSeverity({ rating: 'VERY_BEARISH', conviction: 0.5 });
    expect(score).toBeCloseTo(0.5, 5);
  });

  it('damps NEUTRAL so a high-conviction neutral does not outrank a directional call', () => {
    const neutral = computeMicroActionSeverity({ rating: 'NEUTRAL', conviction: 0.9 });
    const bearish = computeMicroActionSeverity({ rating: 'BEARISH', conviction: 0.7 });
    expect(bearish).toBeGreaterThan(neutral);
  });

  it('clamps the output to [0, 1]', () => {
    // Not reachable in practice — conviction is already bounded — but defensive.
    const high = computeMicroActionSeverity({ rating: 'VERY_BULLISH', conviction: 1 });
    const low = computeMicroActionSeverity({ rating: 'NEUTRAL', conviction: 0 });
    expect(high).toBeLessThanOrEqual(1);
    expect(low).toBeGreaterThanOrEqual(0);
  });
});

describe('microActionSource', () => {
  it('uppercases the ticker', () => {
    expect(microActionSource('aapl')).toBe('micro-observation: AAPL');
  });
});
