import { describe, expect, it } from 'vitest';

import { parseFromMarkdown, serializeToMarkdown } from '../../src/strategies/strategy-serializer.js';

const VALID_MD = `---
name: Price Momentum
description: Go long stocks with strong 12-month returns
category: MARKET
style: momentum
requires:
  - market_data
triggers:
  - type: PRICE_MOVE
    description: 12-month return exceeds 15%
    params:
      threshold: 0.15
      direction: above
tickers: []
maxPositionSize: 0.05
---

## Thesis
Stocks with strong momentum tend to continue outperforming.

## Entry Rules
- Formation period: 12 months
- Go long top decile
`;

describe('parseFromMarkdown', () => {
  it('parses valid markdown into a Strategy', () => {
    const strategy = parseFromMarkdown(VALID_MD);
    expect(strategy.name).toBe('Price Momentum');
    expect(strategy.description).toBe('Go long stocks with strong 12-month returns');
    expect(strategy.category).toBe('MARKET');
    expect(strategy.style).toBe('momentum');
    expect(strategy.requires).toEqual(['market_data']);
    expect(strategy.triggers).toHaveLength(1);
    expect(strategy.triggers[0].type).toBe('PRICE_MOVE');
    expect(strategy.triggers[0].params).toEqual({ threshold: 0.15, direction: 'above' });
    expect(strategy.tickers).toEqual([]);
    expect(strategy.maxPositionSize).toBe(0.05);
    expect(strategy.source).toBe('community');
    expect(strategy.active).toBe(false);
    expect(strategy.content).toContain('## Thesis');
    expect(strategy.content).toContain('## Entry Rules');
  });

  it('generates id from slugified name', () => {
    const strategy = parseFromMarkdown(VALID_MD);
    expect(strategy.id).toBe('price-momentum');
  });

  it('throws on missing required frontmatter fields', () => {
    const bad = `---
name: Test
---
Body here`;
    expect(() => parseFromMarkdown(bad)).toThrow();
  });

  it('throws on unknown capability in requires', () => {
    const bad = VALID_MD.replace('market_data', 'options_chain');
    expect(() => parseFromMarkdown(bad)).toThrow();
  });

  it('throws on invalid trigger type', () => {
    const bad = VALID_MD.replace('PRICE_MOVE', 'INVALID_TYPE');
    expect(() => parseFromMarkdown(bad)).toThrow();
  });

  it('throws on missing frontmatter delimiters', () => {
    expect(() => parseFromMarkdown('no frontmatter here')).toThrow();
  });

  it('defaults requires to empty array when omitted', () => {
    const md = `---
name: Simple Strategy
description: A test
category: RISK
style: risk
triggers:
  - type: DRAWDOWN
    description: Drawdown exceeds threshold
tickers: []
---

Body content here.`;
    const strategy = parseFromMarkdown(md);
    expect(strategy.requires).toEqual([]);
  });
});

describe('serializeToMarkdown', () => {
  it('round-trips: parse then serialize produces valid markdown', () => {
    const strategy = parseFromMarkdown(VALID_MD);
    const md = serializeToMarkdown(strategy);

    expect(md).toContain('name: Price Momentum');
    expect(md).toContain('category: MARKET');
    expect(md).toContain('style: momentum');
    expect(md).toContain('market_data');
    expect(md).toContain('PRICE_MOVE');
    expect(md).toContain('## Thesis');
    expect(md).toContain('## Entry Rules');
  });

  it('excludes internal fields from frontmatter', () => {
    const strategy = parseFromMarkdown(VALID_MD);
    const md = serializeToMarkdown(strategy);

    expect(md).not.toContain('id:');
    expect(md).not.toContain('active:');
    expect(md).not.toContain('source:');
    expect(md).not.toContain('createdBy:');
    expect(md).not.toContain('createdAt:');
  });

  it('re-parsed output matches original strategy fields', () => {
    const original = parseFromMarkdown(VALID_MD);
    const md = serializeToMarkdown(original);
    const reparsed = parseFromMarkdown(md);

    expect(reparsed.name).toBe(original.name);
    expect(reparsed.category).toBe(original.category);
    expect(reparsed.style).toBe(original.style);
    expect(reparsed.requires).toEqual(original.requires);
    expect(reparsed.triggers).toEqual(original.triggers);
    expect(reparsed.content.trim()).toBe(original.content.trim());
  });
});
