/**
 * Progressive enrichment triggers (Phase 1 — deterministic rules, no persisted state).
 *
 * Evaluates a Tier-0 DataBrief + raw Entity against a fixed rule set (T1–T9).
 * Each firing trigger names the EnrichmentField[] to fetch for that ticker and
 * a severity weight. Downstream orchestration:
 *
 *   1. evaluateTriggers(brief, entity) → TriggerHit[] per ticker
 *   2. selectBudgeted(hitsByTicker) → cap per-cycle fan-out to TRIGGER_BUDGET_PER_CYCLE
 *   3. unionFields(hits) → unique field set for the Tier-1 batched enrich
 *
 * Triggers are rules, not LLM decisions. The LLM escape hatch (Phase 2) will
 * layer on top of this module, not replace it.
 */

import type { EnrichmentField, Entity } from '@yojinhq/jintel-client';

import type { DataBrief } from './data-gatherer.js';

export type TriggerId = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7' | 'T8' | 'T9';

export interface TriggerHit {
  id: TriggerId;
  /** Severity weight (0..1) — used to rank tickers when the per-cycle budget is tight. */
  severity: number;
  /** Human-readable reason. Surfaces in logs and in the LLM brief so the analyzer knows why extras were fetched. */
  reason: string;
  /**
   * Extra Jintel sub-graphs to fetch for this ticker. May be empty for
   * "focus-only" triggers (T4/T7/T9) that rely on Tier-0 data but want the
   * analyzer to prioritize it in output.
   */
  fields: EnrichmentField[];
}

/** Max tickers that can escalate to Tier-1 per cycle. Ranked by summed severity. */
export const TRIGGER_BUDGET_PER_CYCLE = 10;

/** Filing types considered material for T6 (new regulatory filing). */
const MATERIAL_FILING_TYPES = new Set<string>(['FILING_8K', 'FILING_10K', 'FILING_10Q', 'ANNUAL_REPORT']);

/** Recency window (days) for T6 "new filing" without persisted trigger state. */
const T6_FILING_WINDOW_DAYS = 3;

/** Severity labels considered "new risk" for T7. */
const HIGH_RISK_SEVERITIES = new Set<string>(['HIGH', 'CRITICAL']);

/** Recency window (days) for T7 high-severity risk signal. */
const T7_RISK_WINDOW_DAYS = 7;

// ---------------------------------------------------------------------------
// Individual trigger rules
// ---------------------------------------------------------------------------

function ruleT1EarningsSoon(entity: Entity | null): TriggerHit | null {
  const earningsDate = entity?.market?.fundamentals?.earningsDate ?? null;
  if (!earningsDate) return null;
  const days = daysUntil(earningsDate);
  if (days == null || days < 0 || days > 7) return null;
  return {
    id: 'T1',
    severity: days <= 2 ? 0.9 : 0.7,
    reason: `Earnings in ${days}d (${earningsDate})`,
    fields: ['earnings'],
  };
}

function ruleT2EarningsSurprise(entity: Entity | null): TriggerHit | null {
  const history = entity?.market?.fundamentals?.earningsHistory ?? [];
  if (history.length === 0) return null;
  const latest = history[0];
  const surprise = latest?.surprisePercent;
  if (surprise == null || !Number.isFinite(surprise)) return null;
  if (Math.abs(surprise) < 10) return null;
  return {
    id: 'T2',
    severity: Math.min(0.9, 0.5 + Math.abs(surprise) / 100),
    reason: `Latest quarter EPS surprise ${surprise > 0 ? '+' : ''}${surprise.toFixed(1)}%`,
    fields: ['segmentedRevenue', 'financials'],
  };
}

function ruleT3SocialSpike(brief: DataBrief): TriggerHit | null {
  const s = brief.socialSentiment;
  if (!s) return null;
  const rankDelta = s.rank24hAgo - s.rank; // positive = improved rank
  const mentionsRatio = s.mentions24hAgo > 0 ? s.mentions / s.mentions24hAgo : null;
  const rankFired = rankDelta >= 30;
  const mentionsFired = mentionsRatio != null && mentionsRatio >= 2;
  if (!rankFired && !mentionsFired) return null;
  const parts: string[] = [];
  if (rankFired) parts.push(`rank ↑${rankDelta}`);
  if (mentionsFired) parts.push(`mentions ×${mentionsRatio?.toFixed(1)}`);
  return {
    id: 'T3',
    severity: rankFired && mentionsFired ? 0.8 : 0.5,
    reason: `Social spike (${parts.join(', ')})`,
    fields: ['social'],
  };
}

function ruleT4PtGap(brief: DataBrief, entity: Entity | null): TriggerHit | null {
  const a = entity?.analyst ?? null;
  const mean = a?.targetMean ?? null;
  const n = a?.numberOfAnalysts ?? 0;
  if (mean == null || n < 5) return null;
  const curPrice = brief.quotePrice ?? brief.currentPrice;
  if (!curPrice || curPrice <= 0) return null;
  const gap = (mean - curPrice) / curPrice;
  if (Math.abs(gap) < 0.1) return null;
  return {
    id: 'T4',
    severity: Math.min(0.7, 0.3 + Math.abs(gap)),
    reason: `Analyst PT ${gap > 0 ? '+' : ''}${(gap * 100).toFixed(1)}% vs current (n=${n})`,
    fields: [], // focus-only; Tier-0 research already fetched
  };
}

function ruleT5PriceShock(brief: DataBrief): TriggerHit | null {
  const change = brief.changePercent;
  if (change == null || !Number.isFinite(change)) return null;
  const atr = brief.technicals?.atr ?? null;
  const price = brief.quotePrice ?? brief.currentPrice;
  if (price > 0 && atr != null && atr > 0) {
    const atrPct = (atr / price) * 100;
    if (Math.abs(change) < 2 * atrPct) return null;
    return {
      id: 'T5',
      severity: Math.min(0.9, 0.4 + Math.abs(change) / 100),
      reason: `Intraday move ${change > 0 ? '+' : ''}${change.toFixed(2)}% (>${(2 * atrPct).toFixed(2)}% = 2×ATR)`,
      fields: ['derivatives'],
    };
  }
  // Fallback when ATR is unavailable: absolute 5% move.
  if (Math.abs(change) < 5) return null;
  return {
    id: 'T5',
    severity: Math.min(0.9, 0.4 + Math.abs(change) / 100),
    reason: `Intraday move ${change > 0 ? '+' : ''}${change.toFixed(2)}% (≥5% fallback threshold)`,
    fields: ['derivatives'],
  };
}

function ruleT6NewFiling(entity: Entity | null): TriggerHit | null {
  const filings = entity?.regulatory?.filings ?? [];
  const cutoff = Date.now() - T6_FILING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recent = filings.filter((f) => {
    if (!MATERIAL_FILING_TYPES.has(f.type)) return false;
    const ts = Date.parse(f.date);
    return Number.isFinite(ts) && ts >= cutoff;
  });
  if (recent.length === 0) return null;
  const types = [...new Set(recent.map((f) => f.type))].join(', ');
  return {
    id: 'T6',
    severity: 0.85,
    reason: `${recent.length} material filing${recent.length === 1 ? '' : 's'} in last ${T6_FILING_WINDOW_DAYS}d (${types})`,
    fields: ['periodicFilings'],
  };
}

function ruleT7HighRisk(entity: Entity | null): TriggerHit | null {
  const signals = entity?.risk?.signals ?? [];
  const cutoff = Date.now() - T7_RISK_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const hits = signals.filter((s) => {
    if (!s.severity || !HIGH_RISK_SEVERITIES.has(s.severity)) return false;
    if (!s.date) return false;
    const ts = Date.parse(s.date);
    return Number.isFinite(ts) && ts >= cutoff;
  });
  if (hits.length === 0) return null;
  const topSeverity = hits[0].severity ?? 'HIGH';
  return {
    id: 'T7',
    severity: hits.some((s) => s.severity === 'CRITICAL') ? 0.95 : 0.75,
    reason: `${hits.length} ${topSeverity.toLowerCase()}-severity risk signal(s) in last ${T7_RISK_WINDOW_DAYS}d`,
    fields: [], // risk + regulatory already at Tier-0; this is a focus signal
  };
}

function ruleT8Squeeze(brief: DataBrief): TriggerHit | null {
  const o = brief.ownership;
  if (!o) return null;
  // daysToCover is not on our OwnershipBrief yet — infer from short ratio for now.
  // Phase 2 adds daysToCover. For now use shortPercentOfFloat >= 15% as the squeeze signal.
  const shortPct = o.shortPercentOfFloat ?? null;
  if (shortPct == null || shortPct < 0.15) return null;
  return {
    id: 'T8',
    severity: Math.min(0.8, 0.4 + shortPct),
    reason: `Short interest ${(shortPct * 100).toFixed(1)}% of float`,
    fields: ['derivatives'],
  };
}

function ruleT9InsiderActivity(brief: DataBrief): TriggerHit | null {
  const it = brief.insiderTrades;
  if (!it) return null;
  const nonPlannedSells = it.sellCount - it.plannedCount;
  const clusterBuy = it.buyCount >= 3;
  const notableSell = nonPlannedSells >= 3 && it.sellValue >= 1_000_000;
  if (!clusterBuy && !notableSell) return null;
  const reason = clusterBuy
    ? `Cluster insider buying (${it.buyCount} buys in ${it.windowDays}d)`
    : `Unplanned insider selling (${nonPlannedSells} sells, $${(it.sellValue / 1e6).toFixed(1)}M)`;
  return {
    id: 'T9',
    severity: clusterBuy ? 0.7 : 0.6,
    reason,
    fields: [], // insiderTrades already in Tier-0; focus-only
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate all triggers against a ticker's Tier-0 data. Returns every rule that
 * fired in declaration order. Callers decide which hits to act on (budgeting,
 * field union, focus-only filtering).
 */
export function evaluateTriggers(brief: DataBrief, entity: Entity | null): TriggerHit[] {
  const candidates: Array<TriggerHit | null> = [
    ruleT1EarningsSoon(entity),
    ruleT2EarningsSurprise(entity),
    ruleT3SocialSpike(brief),
    ruleT4PtGap(brief, entity),
    ruleT5PriceShock(brief),
    ruleT6NewFiling(entity),
    ruleT7HighRisk(entity),
    ruleT8Squeeze(brief),
    ruleT9InsiderActivity(brief),
  ];
  return candidates.filter((h): h is TriggerHit => h !== null);
}

/** Union of fetch fields across a set of hits (drops focus-only triggers with empty `fields`). */
export function unionFields(hits: TriggerHit[]): EnrichmentField[] {
  const set = new Set<EnrichmentField>();
  for (const h of hits) {
    for (const f of h.fields) set.add(f);
  }
  return [...set];
}

/** Sum of severity weights — used to rank tickers when the per-cycle budget is tight. */
export function totalSeverity(hits: TriggerHit[]): number {
  return hits.reduce((sum, h) => sum + h.severity, 0);
}

/**
 * Apply per-cycle budget: sort tickers by totalSeverity descending, keep top N.
 * Dropped tickers are not in the returned map — caller runs Tier-0 only for them.
 */
export function selectBudgeted(
  hitsByTicker: Map<string, TriggerHit[]>,
  budget: number = TRIGGER_BUDGET_PER_CYCLE,
): Map<string, TriggerHit[]> {
  const ranked = [...hitsByTicker.entries()]
    .filter(([, hits]) => hits.length > 0)
    .sort(([, a], [, b]) => totalSeverity(b) - totalSeverity(a))
    .slice(0, budget);
  return new Map(ranked);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysUntil(dateStr: string): number | null {
  const target = Date.parse(dateStr);
  if (!Number.isFinite(target)) return null;
  const now = Date.now();
  return Math.floor((target - now) / (24 * 60 * 60 * 1000));
}
