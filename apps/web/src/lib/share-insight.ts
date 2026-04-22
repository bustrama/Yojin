import type { PositionInsight, InsightRating } from '../api/types';

function sentimentToRating(sentiment?: string | null): InsightRating {
  if (sentiment === 'bullish' || sentiment === 'BULLISH') return 'BULLISH';
  if (sentiment === 'bearish' || sentiment === 'BEARISH') return 'BEARISH';
  return 'NEUTRAL';
}

// Internal ticker sentinels used elsewhere in the UI for items without a
// concrete symbol. Sharing would render them as `$MACRO · Neutral` which is
// misleading — gate the Share menu off entirely when we see one.
const TICKER_SENTINELS = new Set(['MACRO', 'UNKNOWN', 'N/A']);

/**
 * Build a minimal PositionInsight from a feed item's surface fields.
 * Used when the Share button appears on intel feed cards where the full
 * research report isn't in scope. Returns null when no ticker is available
 * or the ticker is a sentinel placeholder.
 */
export function buildShareableFromFeed(params: {
  symbol: string | null | undefined;
  title: string;
  sentiment?: string | null;
  confidence?: number | null;
  opportunities?: string[];
}): PositionInsight | null {
  if (!params.symbol) return null;
  if (TICKER_SENTINELS.has(params.symbol.toUpperCase())) return null;
  const conviction =
    params.confidence != null
      ? Math.max(0, Math.min(1, params.confidence > 1 ? params.confidence / 100 : params.confidence))
      : 0.5;
  return {
    symbol: params.symbol,
    name: params.symbol,
    rating: sentimentToRating(params.sentiment),
    conviction,
    thesis: params.title,
    keySignals: [],
    allSignalIds: [],
    risks: [],
    opportunities: (params.opportunities ?? []).slice(0, 2),
    memoryContext: null,
    priceTarget: null,
  };
}
