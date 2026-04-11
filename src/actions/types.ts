/**
 * Action data model — BUY/SELL/REVIEW outcomes produced by Skills/Strategies.
 *
 * An Action is opinionated: a Strategy trigger fires, an LLM assesses it, and
 * the result is a concrete recommendation (verdict + headline + reasoning) that
 * flows through PENDING -> APPROVED | REJECTED | EXPIRED.
 *
 * Actions are ALWAYS produced by a Skill/Strategy — never by neutral intel
 * pipelines. If a record has no skillId, it is not an Action.
 *
 * Storage: append-only JSONL in data/actions/ (date-partitioned).
 * GraphQL: Action, ActionVerdict, ActionStatus types in schema.ts.
 */

import { z } from 'zod';

import { DateTimeField, IdField } from '../types/base.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Concrete recommendation emitted by the Strategist LLM. */
export const ActionVerdictSchema = z.enum(['BUY', 'SELL', 'TRIM', 'HOLD', 'REVIEW']);
export type ActionVerdict = z.infer<typeof ActionVerdictSchema>;

export const ActionStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED']);
export type ActionStatus = z.infer<typeof ActionStatusSchema>;

// ---------------------------------------------------------------------------
// Action — the core entity
// ---------------------------------------------------------------------------

export const ActionSchema = z.object({
  id: IdField,
  /** Originating skill — required. Actions without a skill are not Actions. */
  skillId: IdField,
  /** Human-readable skill name, e.g. "Momentum Breakout". */
  skillName: z.string().min(1),
  /** Dedup/supersede key: "${skillId}-${triggerType}-${ticker}". */
  triggerId: IdField,
  triggerType: z.string().min(1),
  /** Concrete verdict parsed from LLM headline (BUY/SELL/TRIM/HOLD/REVIEW). */
  verdict: ActionVerdictSchema,
  /** Headline, e.g. "BUY AAPL — golden cross + expanding volume". */
  what: z.string().min(1),
  /** Reasoning trace from the LLM (why this action, risks, sizing). */
  why: z.string().min(1),
  /** Related tickers — typically one for per-asset evaluations. */
  tickers: z.array(z.string().min(1)).default([]),
  /** Formatted trigger context (key=value lines) for audit/debug. */
  riskContext: z.string().optional(),
  /** Optional 0–1 severity; higher = higher priority in the ranker. */
  severity: z.number().min(0).max(1).optional(),
  status: ActionStatusSchema.default('PENDING'),
  expiresAt: DateTimeField,
  createdAt: DateTimeField,
  resolvedAt: DateTimeField.optional(),
  resolvedBy: z.string().optional(), // 'user' | 'timeout' | 'superseded'
  dismissedAt: DateTimeField.optional(),
});
export type Action = z.infer<typeof ActionSchema>;

/**
 * Parse a verdict from an LLM headline like:
 *   "BUY AAPL — golden cross"
 *   "SELL TSLA — breakdown"
 *   "REVIEW portfolio — concentration drift"
 * Falls back to REVIEW when no verdict keyword is present.
 */
export function parseVerdictFromHeadline(headline: string): ActionVerdict {
  const head = headline.trim().toUpperCase();
  // Check word-boundary so "BUYBACK" doesn't match BUY
  const match = head.match(/^(BUY|SELL|TRIM|HOLD|REVIEW)\b/);
  if (match) {
    return match[1] as ActionVerdict;
  }
  return 'REVIEW';
}
