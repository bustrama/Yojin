import { describe, expect, it } from 'vitest';
import { buildShareableFromFeed } from './share-insight';

describe('buildShareableFromFeed', () => {
  it('returns null when symbol is missing', () => {
    expect(buildShareableFromFeed({ symbol: null, title: 'x' })).toBeNull();
    expect(buildShareableFromFeed({ symbol: '', title: 'x' })).toBeNull();
  });

  it('returns null for sentinel tickers', () => {
    expect(buildShareableFromFeed({ symbol: 'MACRO', title: 'x' })).toBeNull();
    expect(buildShareableFromFeed({ symbol: 'unknown', title: 'x' })).toBeNull();
    expect(buildShareableFromFeed({ symbol: 'N/A', title: 'x' })).toBeNull();
  });

  it('maps sentiment to rating', () => {
    expect(buildShareableFromFeed({ symbol: 'AAPL', title: 't', sentiment: 'bullish' })?.rating).toBe('BULLISH');
    expect(buildShareableFromFeed({ symbol: 'AAPL', title: 't', sentiment: 'bearish' })?.rating).toBe('BEARISH');
    expect(buildShareableFromFeed({ symbol: 'AAPL', title: 't', sentiment: null })?.rating).toBe('NEUTRAL');
  });

  it('clamps confidence into [0,1] and accepts percentage form', () => {
    expect(buildShareableFromFeed({ symbol: 'AAPL', title: 't', confidence: 75 })?.conviction).toBe(0.75);
    expect(buildShareableFromFeed({ symbol: 'AAPL', title: 't', confidence: 0.4 })?.conviction).toBe(0.4);
    expect(buildShareableFromFeed({ symbol: 'AAPL', title: 't', confidence: 150 })?.conviction).toBe(1);
    expect(buildShareableFromFeed({ symbol: 'AAPL', title: 't', confidence: -1 })?.conviction).toBe(0);
  });

  it('caps opportunities at 2', () => {
    const out = buildShareableFromFeed({
      symbol: 'AAPL',
      title: 't',
      opportunities: ['a', 'b', 'c', 'd'],
    });
    expect(out?.opportunities).toEqual(['a', 'b']);
  });
});
