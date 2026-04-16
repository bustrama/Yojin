/**
 * Shared LLM reasoning for strategy → action generation.
 *
 * Used by the Scheduler (production) and the strategy-debug CLI (eval).
 * Single source of truth for the system prompt, user message, and response parsing.
 */

import type { Entity } from '@yojinhq/jintel-client';

import { formatTriggerContext } from './format-trigger-context.js';
import type { StrategyEvaluation } from './types.js';
import { ConvictionLevelSchema, parseVerdictFromHeadline } from '../actions/types.js';
import type { ActionVerdict, ConvictionLevel } from '../actions/types.js';
import type { ProviderRouter } from '../ai-providers/router.js';
import { createSubsystemLogger } from '../logging/logger.js';
import type { Signal } from '../signals/types.js';

const logger = createSubsystemLogger('action-reasoning');

// ---------------------------------------------------------------------------
// System prompt — single source of truth
// ---------------------------------------------------------------------------

export const ACTION_SYSTEM_PROMPT = `You are a trading strategist. A strategy trigger has fired. Recommend a concrete action.

Your response MUST start with a one-line headline in this exact format:
ACTION: <BUY|SELL> <TICKER> — <catalyst in 10 words or fewer>

The headline is the catalyst — the specific event or change that makes this actionable NOW.
Do NOT restate trigger metrics in the headline (those are shown separately in the UI).

Then provide trading parameters, one per line:
ENTRY: <price or range, e.g. "$245-250" or "at market">
TARGET: <target price>
STOP: <stop loss price>
HORIZON: <time horizon, e.g. "1-2 weeks", "intraday">
CONVICTION: <LOW|MEDIUM|HIGH>

Then provide concise analysis (2-4 sentences per point):
1. Why this trigger matters — reference specific news, data, or discussions
2. Key risks before acting

Every action is either BUY or SELL. The trigger fired — commit to a direction.
Be direct and concise. No disclaimers.`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActionReasoningResult {
  headline: string;
  verdict: ActionVerdict;
  reasoning: string;
  rawOutput: string;
  /** Whether the LLM produced the result (vs static fallback). */
  fromLlm: boolean;
  /** LLM-suggested entry range, e.g. "$245-250" or "at market". */
  entryRange?: string;
  /** LLM-suggested target exit price. */
  targetPrice?: number;
  /** LLM-suggested stop loss price. */
  stopLoss?: number;
  /** Time horizon, e.g. "1-2 weeks". */
  horizon?: string;
  /** LLM's conviction level. */
  conviction?: ConvictionLevel;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format allocation budget info for the LLM prompt when the strategy has a targetAllocation. */
export function formatAllocationBudget(context: Record<string, unknown>): string {
  const target = context.targetAllocation as number | undefined;
  if (target == null) return '';
  const actual = (context.actualAllocation as number | undefined) ?? 0;
  const remaining = (context.allocationRemaining as number | undefined) ?? Math.max(0, target - actual);
  return `\nAllocation budget: target ${(target * 100).toFixed(0)}% of portfolio, current ${(actual * 100).toFixed(1)}%, remaining ${(remaining * 100).toFixed(1)}%\n`;
}

/** Optional rich context from Jintel entity + curated signals. */
export interface ActionEntityContext {
  entity: Entity;
  signals: Signal[];
}

/** Position sizing computed deterministically from strategy allocation + portfolio state. */
export interface PositionSizing {
  currentPrice: number;
  suggestedQuantity: number;
  suggestedValue: number;
}

/**
 * Compute a deterministic position size from strategy allocation, portfolio value, and current price.
 * Returns null if there's not enough data to compute (no allocation target or no price).
 */
export function computePositionSizing(
  context: Record<string, unknown>,
  currentPrice: number | undefined,
  totalPortfolioValue: number | undefined,
): PositionSizing | null {
  if (!currentPrice || !totalPortfolioValue || totalPortfolioValue <= 0) return null;

  const target = context.targetAllocation as number | undefined;
  const actual = (context.actualAllocation as number | undefined) ?? 0;
  const maxPosition = context.maxPositionSize as number | undefined;

  // Compute the remaining allocation budget
  let allocationFraction: number;
  if (target != null) {
    allocationFraction = Math.max(0, target - actual);
  } else if (maxPosition != null) {
    allocationFraction = Math.max(0, maxPosition - actual);
  } else {
    return null; // No allocation constraints defined
  }

  const suggestedValue = allocationFraction * totalPortfolioValue;
  if (suggestedValue <= 0) return null;

  const suggestedQuantity = Math.floor(suggestedValue / currentPrice);
  if (suggestedQuantity <= 0) return null;

  return { currentPrice, suggestedQuantity, suggestedValue };
}

/** Format entity sub-graph data so the LLM can reference real headlines and discussions. */
export function formatEntityBrief(ctx: ActionEntityContext): string {
  const sections: string[] = [];

  const news = ctx.entity.news;
  if (news?.length) {
    const lines = news.slice(0, 10).map((n) => {
      const sentiment =
        n.sentimentScore != null
          ? ` [sentiment: ${n.sentimentScore > 0 ? '+' : ''}${n.sentimentScore.toFixed(2)}]`
          : '';
      return `- [${n.source}] ${n.title}${sentiment}${n.date ? ` (${n.date})` : ''}`;
    });
    sections.push(`Recent news:\n${lines.join('\n')}`);
  }

  const social = ctx.entity.social;
  if (social?.reddit?.length) {
    const posts = social.reddit
      .slice(0, 8)
      .map((p) => `- r/${p.subreddit}: ${p.title} (score: ${p.score}, comments: ${p.numComments})`);
    sections.push(`Reddit discussions:\n${posts.join('\n')}`);
  }

  const s = ctx.entity.sentiment;
  if (s) {
    const rankDelta = s.rank24hAgo - s.rank;
    const rankDir = rankDelta > 0 ? `↑${rankDelta}` : rankDelta < 0 ? `↓${Math.abs(rankDelta)}` : '→';
    const mentionDelta = s.mentions - s.mentions24hAgo;
    const mentionDir = mentionDelta > 0 ? `+${mentionDelta}` : `${mentionDelta}`;
    sections.push(
      `Social sentiment: rank #${s.rank} (${rankDir} 24h) | mentions: ${s.mentions} (${mentionDir}) | upvotes: ${s.upvotes}`,
    );
  }

  const research = ctx.entity.research;
  if (research?.length) {
    const lines = research
      .slice(0, 5)
      .map((r) => `- ${r.title}${r.author ? ` — ${r.author}` : ''}${r.publishedDate ? ` (${r.publishedDate})` : ''}`);
    sections.push(`Research:\n${lines.join('\n')}`);
  }

  const recentSignals = ctx.signals
    .filter((sig) => sig.tier1 || sig.title)
    .slice(0, 8)
    .map((sig) => `- [${sig.type}] ${sig.title}${sig.tier1 ? `: ${sig.tier1}` : ''}`);
  if (recentSignals.length) {
    sections.push(`Recent signals:\n${recentSignals.join('\n')}`);
  }

  return sections.join('\n\n');
}

/** Build the user message sent to the LLM for a single evaluation. */
export function buildUserMessage(
  evaluation: StrategyEvaluation,
  entityContext?: ActionEntityContext,
  sizing?: PositionSizing | null,
): string {
  const ticker = (evaluation.context.ticker as string | undefined) ?? 'portfolio-wide';
  const contextParts = formatTriggerContext(evaluation.context);

  const entityBrief = entityContext ? formatEntityBrief(entityContext) : '';
  const sizingInfo = sizing
    ? `\nPosition sizing: ${sizing.suggestedQuantity} shares (~$${sizing.suggestedValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}) at $${sizing.currentPrice.toFixed(2)}/share`
    : '';

  return `Strategy: ${evaluation.strategyName}
Trigger: ${evaluation.triggerDescription}
Ticker: ${ticker}
Trigger data: ${contextParts.join(', ')}
${formatAllocationBudget(evaluation.context)}${sizingInfo}
${entityBrief ? `\nMarket context for ${ticker}:\n${entityBrief}\n` : ''}
Strategy rules:
${evaluation.strategyContent}

Provide your ACTION headline and analysis. Reference specific news, discussions, or data points — do not speculate about what might be causing the trigger.`;
}

/** Regex for structured parameter lines — used to filter them out of reasoning text. */
const PARAM_LINE_RE = /^(ENTRY|TARGET|STOP|HORIZON|CONVICTION):/i;

/** Valid conviction values for clamping LLM output. */
const VALID_CONVICTIONS: Set<string> = new Set(ConvictionLevelSchema.options);

export interface StructuredParams {
  entryRange?: string;
  targetPrice?: number;
  stopLoss?: number;
  horizon?: string;
  conviction?: ConvictionLevel;
}

/** Parse structured trading parameters from LLM output lines. Each field parsed independently. */
export function parseStructuredParams(lines: string[]): StructuredParams {
  const result: StructuredParams = {};

  for (const line of lines) {
    const trimmed = line.trim();

    const entryMatch = trimmed.match(/^ENTRY:\s*(.+)/i);
    if (entryMatch) {
      result.entryRange = entryMatch[1].trim();
      continue;
    }

    const targetMatch = trimmed.match(/^TARGET:\s*\$?([\d,.]+)/i);
    if (targetMatch) {
      const val = parseFloat(targetMatch[1].replace(/,/g, ''));
      if (Number.isFinite(val) && val > 0) result.targetPrice = val;
      continue;
    }

    const stopMatch = trimmed.match(/^STOP:\s*\$?([\d,.]+)/i);
    if (stopMatch) {
      const val = parseFloat(stopMatch[1].replace(/,/g, ''));
      if (Number.isFinite(val) && val > 0) result.stopLoss = val;
      continue;
    }

    const horizonMatch = trimmed.match(/^HORIZON:\s*(.+)/i);
    if (horizonMatch) {
      result.horizon = horizonMatch[1].trim();
      continue;
    }

    const convictionMatch = trimmed.match(/^CONVICTION:\s*(\w+)/i);
    if (convictionMatch) {
      const val = convictionMatch[1].toUpperCase();
      if (VALID_CONVICTIONS.has(val)) {
        result.conviction = val as ConvictionLevel;
      }
      continue;
    }
  }

  return result;
}

/** Parse the LLM response into headline + reasoning + structured params. */
export function parseActionResponse(
  rawOutput: string,
  evaluation: StrategyEvaluation,
): { headline: string; reasoning: string } & StructuredParams {
  const ticker = (evaluation.context.ticker as string | undefined) ?? 'portfolio';

  const lines = rawOutput.split('\n').filter(Boolean);
  const actionMatch = lines[0]?.match(/^ACTION:\s*(.+)/i);

  const params = parseStructuredParams(lines);

  // Filter out the structured parameter lines from reasoning
  const reasoningLines = lines.slice(1).filter((l) => !PARAM_LINE_RE.test(l.trim()));

  if (actionMatch) {
    return {
      headline: actionMatch[1].trim(),
      reasoning: reasoningLines.join('\n').trim(),
      ...params,
    };
  }

  // Fallback when LLM didn't produce structured output
  return {
    headline: `REVIEW ${ticker} — ${evaluation.triggerDescription}`,
    reasoning: rawOutput,
    ...params,
  };
}

// ---------------------------------------------------------------------------
// Main reasoning function
// ---------------------------------------------------------------------------

/**
 * Generate an action recommendation for a single strategy evaluation.
 *
 * Calls the LLM with the standard strategist prompt and parses the response.
 * Falls back to a static REVIEW headline when the LLM is unavailable.
 */
export async function generateActionReasoning(
  evaluation: StrategyEvaluation,
  providerRouter: ProviderRouter | null,
  entityContext?: ActionEntityContext,
  sizing?: PositionSizing | null,
): Promise<ActionReasoningResult> {
  const ticker = (evaluation.context.ticker as string | undefined) ?? 'portfolio';

  if (providerRouter) {
    logger.info('Requesting LLM reasoning for strategy trigger', {
      strategyId: evaluation.strategyId,
      ticker,
    });
    try {
      const llmResult = await providerRouter.completeWithTools({
        model: 'sonnet',
        system: ACTION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserMessage(evaluation, entityContext, sizing) }],
        maxTokens: 512,
      });

      const rawOutput = llmResult.content
        .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
        .map((b) => b.text)
        .join('');

      if (rawOutput) {
        const { headline, reasoning, entryRange, targetPrice, stopLoss, horizon, conviction } = parseActionResponse(
          rawOutput,
          evaluation,
        );
        const finalHeadline = headline || `REVIEW ${ticker} — ${evaluation.triggerDescription}`;
        const finalReasoning = reasoning || evaluation.triggerDescription;

        logger.info('LLM reasoning generated for strategy trigger', {
          strategyId: evaluation.strategyId,
          ticker,
          headline: finalHeadline,
          length: rawOutput.length,
        });

        return {
          headline: finalHeadline,
          verdict: parseVerdictFromHeadline(finalHeadline),
          reasoning: finalReasoning,
          rawOutput,
          fromLlm: true,
          entryRange,
          targetPrice,
          stopLoss,
          horizon,
          conviction,
        };
      }
    } catch (err) {
      logger.warn('LLM reasoning failed for strategy trigger, using static content', {
        strategyId: evaluation.strategyId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Static fallback
  const headline = `REVIEW ${ticker} — ${evaluation.triggerDescription}`;
  return {
    headline,
    verdict: parseVerdictFromHeadline(headline),
    reasoning: evaluation.triggerDescription,
    rawOutput: '',
    fromLlm: false,
  };
}
