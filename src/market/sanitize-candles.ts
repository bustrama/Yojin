/**
 * Candle sanitation shared between the sparkline builder and the price-history
 * resolver. Strips two kinds of bad points:
 *   1. Invalid OHLC (non-finite, non-positive, or high < low).
 *   2. Zero-volume "spike" candles — a Jintel/Yahoo artifact during extended
 *      hours and session boundaries where no trades happened but the feed
 *      still emits a candle with an unreliable range.
 */

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function isValidOHLC(c: Candle): boolean {
  return (
    Number.isFinite(c.open) &&
    Number.isFinite(c.high) &&
    Number.isFinite(c.low) &&
    Number.isFinite(c.close) &&
    c.open > 0 &&
    c.high > 0 &&
    c.low > 0 &&
    c.close > 0 &&
    c.high >= c.low
  );
}

const NEIGHBOR_WINDOW = 5;
const SPIKE_FACTOR = 2;

export function sanitizeCandles<T extends Candle>(data: T[]): T[] {
  if (data.length < 3) return data.filter(isValidOHLC);

  return data.filter((candle, i) => {
    if (!isValidOHLC(candle)) return false;
    if (candle.volume > 0) return true;

    const start = Math.max(0, i - NEIGHBOR_WINDOW);
    const end = Math.min(data.length, i + NEIGHBOR_WINDOW + 1);
    const neighborRanges: number[] = [];

    for (let j = start; j < end; j++) {
      if (j !== i && isValidOHLC(data[j]) && data[j].volume > 0) {
        neighborRanges.push(data[j].high - data[j].low);
      }
    }

    if (neighborRanges.length < 2) return true;

    neighborRanges.sort((a, b) => a - b);
    const medianRange = neighborRanges[Math.floor(neighborRanges.length / 2)];
    const candleRange = candle.high - candle.low;

    return candleRange <= medianRange * SPIKE_FACTOR;
  });
}
