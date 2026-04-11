/**
 * Summary data model — neutral intel observations produced by the insight
 * pipelines (macro + micro). Summaries are NOT opinionated — they do not
 * contain BUY/SELL recommendations and have no approval lifecycle. They are
 * the Intel Feed content layer.
 *
 * Summaries NEVER come from Strategies — strategy-triggered records are
 * Actions and live in src/actions/. If a producer mentions strategyId, it's
 * writing to the wrong store.
 *
 * Storage: append-only JSONL in data/summaries/ (date-partitioned).
 * GraphQL: Summary type in schema.ts.
 */

import { createHash } from 'node:crypto';

import { z } from 'zod';

import { DateTimeField, IdField, ScoreRange } from '../types/base.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Which flow produced this summary. */
export const SummaryFlowSchema = z.enum(['MACRO', 'MICRO']);
export type SummaryFlow = z.infer<typeof SummaryFlowSchema>;

/**
 * Sentinel ticker used for portfolio-wide summaries (cross-cutting risks,
 * opportunities, action items that span multiple positions or macro themes).
 * Producers must only use this for genuinely cross-cutting observations;
 * single-ticker content belongs under that ticker. The display layer strips
 * this bucket to avoid rendering the sentinel as a fake tradeable symbol.
 */
export const PORTFOLIO_TICKER = 'PORTFOLIO';

// ---------------------------------------------------------------------------
// Summary — the core entity
// ---------------------------------------------------------------------------

export const SummarySchema = z.object({
  id: IdField,
  /** Ticker this observation is about. Portfolio-wide summaries use 'PORTFOLIO'. */
  ticker: z.string().min(1),
  /** One-line neutral observation: "Truist cuts AAPL PT to $323". */
  what: z.string().min(1),
  /** Which pipeline emitted this summary. */
  flow: SummaryFlowSchema,
  /** Optional 0–1 priority score — used for ranking in the Intel Feed. */
  severity: ScoreRange.optional(),
  /** Signals this observation was derived from (for traceability). */
  sourceSignalIds: z.array(IdField).default([]),
  /**
   * Stable dedup hash: sha256(`${ticker}|${flow}|${normalizedWhat}`).
   * Two summaries with the same contentHash within the dedup window are
   * treated as duplicates — the newer one wins, the older one is skipped.
   */
  contentHash: z.string().min(1),
  createdAt: DateTimeField,
});
export type Summary = z.infer<typeof SummarySchema>;

/**
 * Compute the stable content hash for a summary. Used for dedup so the same
 * observation arriving from micro and then macro doesn't double-fire in the
 * Intel Feed.
 */
export function computeSummaryContentHash(ticker: string, flow: SummaryFlow, what: string): string {
  const normalized = what.trim().toLowerCase().replace(/\s+/g, ' ');
  return createHash('sha256').update(`${ticker.toUpperCase()}|${flow}|${normalized}`).digest('hex');
}

/**
 * Extract a display-ready lead paragraph from a longer thesis / free-form text.
 * Unlike a "first sentence" extractor, this preserves the full narrative up to
 * `maxLen` characters and trims on the nearest word boundary so the reader
 * keeps context rather than being cut off after a 7-char fragment like
 * "MFI 75." (which is the first sentence of "MFI 75. RSI neutral. …").
 *
 * Used by the macro summary builder — tests in
 * `test/summaries/types.test.ts` cap on word boundaries and the ellipsis.
 */
export function extractLead(text: string, maxLen = 400): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  if (trimmed.length <= maxLen) return trimmed;
  const truncated = trimmed.slice(0, maxLen - 1);
  const lastSpace = truncated.lastIndexOf(' ');
  const safe = lastSpace > maxLen * 0.5 ? truncated.slice(0, lastSpace) : truncated;
  return safe.replace(/[,;:\s]+$/, '') + '…';
}

/**
 * Quality gate for Summary.what text. Rejects bare-indicator or metadata
 * strings like "MFI 75.", "RSI 80", "Price 108.45" that carry no narrative.
 *
 * Rule: a usable observation must contain at least two alphabetic word
 * tokens of 3+ letters. That lets through "Gap up on no catalyst"
 * (2 alpha runs: "Gap", "catalyst") and "Convertible bond inflows" while
 * blocking "MFI 75." (1 alpha run: "MFI") and "RSI 80" (1 alpha run).
 *
 * The gate is applied at the summary producer layer — not at the SummaryStore
 * — so the store stays a pure persistence layer and the policy is owned by
 * the pipelines that produce observations.
 */
export function hasSubstance(text: string): boolean {
  const alphaWords = text.match(/[A-Za-z]{3,}/g);
  return (alphaWords?.length ?? 0) >= 2;
}
