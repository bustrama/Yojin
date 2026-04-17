/**
 * Ticker suggester — one-shot Sonnet call that proposes tickers for a strategy.
 *
 * Read the strategy definition, suggest 5-15 tickers the strategy could apply to,
 * excluding any the user already holds. Output is user-facing suggestions — the UI
 * shows them in a modal and the user picks which to add to the watchlist.
 */

import { z } from 'zod';

import type { Strategy } from './types.js';
import type { ProviderRouter } from '../ai-providers/router.js';
import { AssetClassSchema } from '../api/graphql/types.js';
import { createSubsystemLogger } from '../logging/logger.js';
import { IdField } from '../types/base.js';

const logger = createSubsystemLogger('ticker-suggester');

export const TickerSuggestionSchema = z.object({
  symbol: IdField,
  name: z.string().min(1),
  assetClass: AssetClassSchema,
  rationale: z.string().min(1),
  confidence: z.number().min(0).max(1),
});
export type TickerSuggestion = z.infer<typeof TickerSuggestionSchema>;

const MIN_SUGGESTIONS = 5;
const MAX_SUGGESTIONS = 15;

const SYSTEM_PROMPT = `You are a portfolio research assistant. Given a trading strategy definition, propose ${MIN_SUGGESTIONS}–${MAX_SUGGESTIONS} tickers the strategy could be applied to so the user can add them to their watchlist.

Rules:
- Propose tickers that fit the strategy's thesis, style, category, and any instrument hints in the content.
- Exclude any ticker the user already holds (listed below). These are already covered by the rest of the app — your job is to surface NEW opportunities.
- Prefer tickers with good data coverage (major exchanges for EQUITY, top-50 market cap for CRYPTO). Do not invent tickers.
- Use canonical ticker symbols: stocks as exchange symbols (e.g. AAPL, MSFT), crypto as Jintel-style (e.g. BTC, ETH).
- Each suggestion must include a concrete 1-sentence rationale tied to the strategy's thesis (not generic).
- Confidence reflects how well the ticker fits the strategy: 0.9+ = textbook match, 0.7-0.9 = strong fit, 0.5-0.7 = reasonable fit, <0.5 = stretch.

Output ONLY a valid JSON array matching this schema — no prose, no markdown:
[
  {
    "symbol": "TICKER",
    "name": "Company or asset name",
    "assetClass": "EQUITY" | "CRYPTO" | "BOND" | "COMMODITY" | "CURRENCY" | "OTHER",
    "rationale": "1 sentence — why this fits the strategy",
    "confidence": 0.0-1.0
  }
]`;

export interface SuggestTickersInput {
  strategy: Strategy;
  excludeSymbols: Set<string>;
}

export class TickerSuggester {
  constructor(private readonly providerRouter: ProviderRouter) {}

  async suggest(input: SuggestTickersInput): Promise<TickerSuggestion[]> {
    const { strategy, excludeSymbols } = input;
    const start = Date.now();

    const excludeList = [...excludeSymbols].sort().join(', ') || '(none)';
    const userMessage = [
      `Strategy: ${strategy.name}`,
      `Category: ${strategy.category}`,
      `Style: ${strategy.style}`,
      `Description: ${strategy.description}`,
      strategy.tickers.length > 0
        ? `Declared tickers (use as hints, not exclusive): ${strategy.tickers.join(', ')}`
        : '',
      strategy.assetClasses.length > 0 ? `Target asset classes: ${strategy.assetClasses.join(', ')}` : '',
      `Already held by user (MUST exclude): ${excludeList}`,
      '',
      'Strategy content:',
      strategy.content,
    ]
      .filter(Boolean)
      .join('\n');

    const result = await this.providerRouter.completeWithTools({
      model: 'sonnet',
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 2048,
    });

    const text = result.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      logger.warn('No JSON array found in ticker suggester response', { strategyId: strategy.id });
      return [];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (err) {
      logger.warn('Failed to parse ticker suggester JSON', { strategyId: strategy.id, error: String(err) });
      return [];
    }

    if (!Array.isArray(parsed)) return [];

    const suggestions: TickerSuggestion[] = [];
    for (const raw of parsed) {
      const candidate = TickerSuggestionSchema.safeParse(normalizeSuggestion(raw));
      if (!candidate.success) continue;
      const symbol = candidate.data.symbol.toUpperCase();
      if (excludeSymbols.has(symbol)) continue;
      if (suggestions.some((s) => s.symbol === symbol)) continue;
      suggestions.push({ ...candidate.data, symbol });
      if (suggestions.length >= MAX_SUGGESTIONS) break;
    }

    logger.info('Ticker suggestions generated', {
      strategyId: strategy.id,
      count: suggestions.length,
      durationMs: Date.now() - start,
    });

    return suggestions;
  }
}

function normalizeSuggestion(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const r = raw as Record<string, unknown>;
  const confidence = typeof r.confidence === 'number' ? Math.max(0, Math.min(1, r.confidence)) : r.confidence;
  const symbol = typeof r.symbol === 'string' ? r.symbol.trim().toUpperCase() : r.symbol;
  return { ...r, symbol, confidence };
}
