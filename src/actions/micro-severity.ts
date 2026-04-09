/**
 * Micro action severity — the ranking signal used to decide whether a micro
 * observation should be promoted into an Action (and supersede older pending
 * ones for the same ticker).
 *
 * Severity acts as priority: 1 = critical, 0 = noise. Computed from the
 * MicroInsight's conviction and rating — the same numbers the LLM already
 * produces, no extra call needed.
 */

import type { InsightRating } from '../insights/types.js';

/**
 * Multiplier per rating. Extremes (VERY_*) dominate, directional takes a
 * modest bump, NEUTRAL is damped — neutral 90% conviction shouldn't outrank
 * a BEARISH 70% conviction on the same ticker.
 */
const RATING_MULTIPLIER: Record<InsightRating, number> = {
  VERY_BULLISH: 1.0,
  VERY_BEARISH: 1.0,
  BULLISH: 0.7,
  BEARISH: 0.7,
  NEUTRAL: 0.4,
};

/** Score a micro insight on 0–1. */
export function computeMicroActionSeverity(insight: { rating: InsightRating; conviction: number }): number {
  const multiplier = RATING_MULTIPLIER[insight.rating] ?? 0.4;
  const raw = insight.conviction * multiplier;
  return Math.max(0, Math.min(1, raw));
}

/** Canonical `source` field value for an action emitted by the micro runner. */
export function microActionSource(ticker: string): string {
  return `micro-observation: ${ticker.toUpperCase()}`;
}
