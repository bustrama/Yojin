import { describe, expect, it } from 'vitest';

import { extractTickers } from '../../src/news/ticker-extractor.js';
import type { SymbolResolver } from '../../src/news/ticker-extractor.js';

describe('extractTickers', () => {
  // -------------------------------------------------------------------------
  // Cashtag patterns
  // -------------------------------------------------------------------------

  it('extracts cashtag tickers', () => {
    expect(extractTickers('$AAPL is up 5% today')).toEqual(['AAPL']);
  });

  it('extracts multiple cashtags', () => {
    expect(extractTickers('$AAPL and $TSLA both rallied, $MSFT flat')).toEqual(['AAPL', 'MSFT', 'TSLA']);
  });

  it('deduplicates cashtags', () => {
    expect(extractTickers('$AAPL beats earnings, $AAPL stock soars')).toEqual(['AAPL']);
  });

  it('filters false positive cashtags', () => {
    expect(extractTickers('$THE market is $UP today')).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Exchange-prefixed patterns
  // -------------------------------------------------------------------------

  it('extracts NASDAQ:TICKER format', () => {
    expect(extractTickers('NASDAQ:AAPL hit new highs')).toEqual(['AAPL']);
  });

  it('extracts NYSE:TICKER format', () => {
    expect(extractTickers('NYSE:BA dropped after grounding')).toEqual(['BA']);
  });

  it('extracts multiple exchange-prefixed tickers', () => {
    const result = extractTickers('NASDAQ:AAPL and NYSE:TSLA both moved');
    expect(result).toEqual(['AAPL', 'TSLA']);
  });

  // -------------------------------------------------------------------------
  // Crypto pair patterns
  // -------------------------------------------------------------------------

  it('extracts crypto pairs as -USD tickers', () => {
    expect(extractTickers('BTC-USD broke $70k resistance')).toEqual(['BTC-USD']);
  });

  it('normalizes crypto pairs to -USD', () => {
    expect(extractTickers('ETH-USDT trading at $3500')).toEqual(['ETH-USD']);
  });

  it('extracts multiple crypto pairs', () => {
    const result = extractTickers('BTC-USD and ETH-USD both up');
    expect(result).toEqual(['BTC-USD', 'ETH-USD']);
  });

  // -------------------------------------------------------------------------
  // Mixed patterns
  // -------------------------------------------------------------------------

  it('combines cashtags, exchange-prefixed, and crypto pairs', () => {
    const text = '$AAPL rallied while NASDAQ:MSFT was flat. BTC-USD surged past $70k.';
    expect(extractTickers(text)).toEqual(['AAPL', 'BTC-USD', 'MSFT']);
  });

  it('returns empty array for text with no tickers', () => {
    expect(extractTickers('The Federal Reserve held rates steady today.')).toEqual([]);
  });

  it('returns sorted results', () => {
    expect(extractTickers('$TSLA $AAPL $MSFT')).toEqual(['AAPL', 'MSFT', 'TSLA']);
  });

  // -------------------------------------------------------------------------
  // SymbolResolver integration
  // -------------------------------------------------------------------------

  it('filters tickers through SymbolResolver when provided', () => {
    const resolver: SymbolResolver = {
      isKnownSymbol: (t) => t === 'AAPL' || t === 'TSLA',
    };
    expect(extractTickers('$AAPL $XYZZ $TSLA', resolver)).toEqual(['AAPL', 'TSLA']);
  });

  it('removes all tickers if resolver rejects them', () => {
    const resolver: SymbolResolver = {
      isKnownSymbol: () => false,
    };
    expect(extractTickers('$AAPL $TSLA', resolver)).toEqual([]);
  });
});
