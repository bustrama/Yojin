/**
 * Micro severity helper tests — the scoring function that gates whether
 * a micro observation should be promoted to a Summary.
 */

import { describe, expect, it } from 'vitest';

import { computeMicroSummarySeverity, microSummarySource } from '../../src/summaries/micro-severity.js';

describe('computeMicroSummarySeverity', () => {
  describe('LLM-emitted severity (primary path)', () => {
    it('returns the LLM severity field when present', () => {
      const score = computeMicroSummarySeverity({ rating: 'BULLISH', conviction: 0.5, severity: 0.92 });
      expect(score).toBeCloseTo(0.92, 5);
    });

    it('trusts LLM severity even when it disagrees with rating/conviction', () => {
      // A VERY_BEARISH rating on a low-severity event (e.g. tiny, already-priced-in headline)
      // — we want the LLM's call, not the rating-derived 1.0 ceiling.
      const score = computeMicroSummarySeverity({ rating: 'VERY_BEARISH', conviction: 0.9, severity: 0.2 });
      expect(score).toBeCloseTo(0.2, 5);
    });

    it('clamps LLM severity to [0, 1] defensively', () => {
      // Zod validates the field on the schema, but the helper is defensive in case
      // a caller bypasses it with a raw object.
      expect(computeMicroSummarySeverity({ rating: 'NEUTRAL', conviction: 0.5, severity: 1.5 })).toBe(1);
      expect(computeMicroSummarySeverity({ rating: 'NEUTRAL', conviction: 0.5, severity: -0.2 })).toBe(0);
    });
  });

  describe('derived fallback (legacy insights without severity)', () => {
    it('scores VERY_BULLISH at full multiplier', () => {
      const score = computeMicroSummarySeverity({ rating: 'VERY_BULLISH', conviction: 0.9 });
      expect(score).toBeCloseTo(0.9, 5);
    });

    it('scores VERY_BEARISH at full multiplier', () => {
      const score = computeMicroSummarySeverity({ rating: 'VERY_BEARISH', conviction: 0.5 });
      expect(score).toBeCloseTo(0.5, 5);
    });

    it('damps NEUTRAL so a high-conviction neutral does not outrank a directional call', () => {
      const neutral = computeMicroSummarySeverity({ rating: 'NEUTRAL', conviction: 0.9 });
      const bearish = computeMicroSummarySeverity({ rating: 'BEARISH', conviction: 0.7 });
      expect(bearish).toBeGreaterThan(neutral);
    });

    it('clamps the fallback output to [0, 1]', () => {
      const high = computeMicroSummarySeverity({ rating: 'VERY_BULLISH', conviction: 1 });
      const low = computeMicroSummarySeverity({ rating: 'NEUTRAL', conviction: 0 });
      expect(high).toBeLessThanOrEqual(1);
      expect(low).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('microSummarySource', () => {
  it('uppercases the ticker', () => {
    expect(microSummarySource('aapl')).toBe('micro-observation: AAPL');
  });
});
