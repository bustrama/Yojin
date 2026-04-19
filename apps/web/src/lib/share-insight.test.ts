import { describe, expect, it } from 'vitest';
import type { PositionInsight } from '../api/types';
import { buildInsightSnippet, buildTelegramUrl, buildWhatsAppUrl, buildXUrl } from './share-insight';

const baseInsight: PositionInsight = {
  symbol: 'AAPL',
  name: 'Apple Inc.',
  rating: 'BULLISH',
  conviction: 0.75,
  thesis: 'Services growth and strong iPhone 17 cycle support a continued re-rating through FY25.',
  keySignals: [],
  allSignalIds: ['sig-1', 'sig-2'],
  risks: ['China demand softness', 'Regulatory pressure on App Store'],
  opportunities: ['AI features drive upgrades', 'Services margin expansion'],
  memoryContext: 'User bought 100 shares at $145 in March; conviction was initially 0.5.',
  priceTarget: 260.0,
  carriedForward: false,
};

describe('buildInsightSnippet', () => {
  it('includes thesis quote, bull/bear sections, attribution', () => {
    const { long } = buildInsightSnippet(baseInsight);
    expect(long).toContain(`"${baseInsight.thesis}"`);
    expect(long).toContain('Bull case');
    expect(long).toContain('Bear case');
    expect(long).toContain('yojin.ai');
    expect(long).not.toMatch(/\$AAPL/);
    expect(long).not.toContain('Bullish');
  });

  it('excludes portfolio-tied and private fields', () => {
    const { long, short, caption } = buildInsightSnippet(baseInsight);
    for (const output of [long, short, caption]) {
      expect(output).not.toContain(baseInsight.memoryContext ?? '__never__');
      expect(output).not.toContain('260');
      expect(output).not.toContain('145');
      expect(output).not.toContain('sig-1');
    }
  });

  it('caption is minimal — header line + one-line attribution only', () => {
    const { caption } = buildInsightSnippet(baseInsight);
    expect(caption).toContain('$AAPL');
    expect(caption).toContain('Bullish');
    expect(caption).toContain('Yojin');
    expect(caption).toContain('yojin.ai');
    expect(caption).not.toContain(baseInsight.thesis);
    expect(caption).not.toContain(baseInsight.risks[0]);
    expect(caption).not.toContain(baseInsight.opportunities[0]);
    expect(caption).not.toMatch(/\d+%/);
    expect(caption.split('\n').length).toBeLessThanOrEqual(2);
  });

  it('caps short form at 280 chars', () => {
    const longThesis = 'A'.repeat(1000);
    const { short } = buildInsightSnippet({ ...baseInsight, thesis: longThesis });
    expect(short.length).toBeLessThanOrEqual(280);
    expect(short).toContain('$AAPL');
    expect(short).toContain('Yojin');
  });

  it('caps bull/bear cases at 2 entries each', () => {
    const { long } = buildInsightSnippet({
      ...baseInsight,
      risks: ['r1', 'r2', 'r3', 'r4'],
      opportunities: ['o1', 'o2', 'o3'],
    });
    expect(long).toContain('r1');
    expect(long).toContain('r2');
    expect(long).not.toContain('r3');
    expect(long).toContain('o1');
    expect(long).toContain('o2');
    expect(long).not.toContain('o3');
  });
});

describe('platform URL builders', () => {
  it('encodes text for Telegram', () => {
    const url = buildTelegramUrl('hello world');
    expect(url.startsWith('https://t.me/share/url')).toBe(true);
    expect(url).toContain('text=hello+world');
  });

  it('encodes text for WhatsApp', () => {
    const url = buildWhatsAppUrl('hello & world');
    expect(url.startsWith('https://wa.me/')).toBe(true);
    expect(url).toContain('text=hello%20%26%20world');
  });

  it('encodes text for X', () => {
    const url = buildXUrl('hi');
    expect(url.startsWith('https://x.com/intent/tweet')).toBe(true);
    expect(url).toContain('text=hi');
  });
});
