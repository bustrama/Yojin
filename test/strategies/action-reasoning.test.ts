import { describe, expect, it } from 'vitest';

import { parseActionResponse, parseStructuredParams } from '../../src/strategies/action-reasoning.js';
import type { StrategyEvaluation } from '../../src/strategies/types.js';

/** Minimal evaluation fixture for testing parse functions. */
function makeEvaluation(overrides?: Partial<StrategyEvaluation>): StrategyEvaluation {
  return {
    strategyId: 'strat-001',
    strategyName: 'Momentum Breakout',
    triggerId: 'strat-001-PRICE_MOVE-TSLA',
    triggerType: 'PRICE_MOVE',
    triggerDescription: 'Price moved +5.2%',
    context: { ticker: 'TSLA', change: 0.052, threshold: 0.05 },
    strategyContent: '# Momentum Breakout\nBuy on breakout...',
    evaluatedAt: new Date().toISOString(),
    triggerStrength: 'STRONG',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// parseStructuredParams
// ---------------------------------------------------------------------------

describe('parseStructuredParams', () => {
  it('parses all structured params from well-formed lines', () => {
    const lines = [
      'ACTION: BUY TSLA — AI5 chip milestone confirmed',
      'ENTRY: $245-250',
      'TARGET: $275',
      'STOP: $230',
      'HORIZON: 1-2 weeks',
      'CONVICTION: HIGH',
      '',
      '## Why Now',
      'The AI5 chip partnership was confirmed...',
    ];
    const params = parseStructuredParams(lines);
    expect(params.entryRange).toBe('$245-250');
    expect(params.targetPrice).toBe(275);
    expect(params.stopLoss).toBe(230);
    expect(params.horizon).toBe('1-2 weeks');
    expect(params.conviction).toBe('HIGH');
  });

  it('handles "at market" entry range', () => {
    const params = parseStructuredParams(['ENTRY: at market']);
    expect(params.entryRange).toBe('at market');
  });

  it('handles prices with commas', () => {
    const params = parseStructuredParams(['TARGET: $1,250.50', 'STOP: $1,100']);
    expect(params.targetPrice).toBe(1250.5);
    expect(params.stopLoss).toBe(1100);
  });

  it('handles prices without dollar signs', () => {
    const params = parseStructuredParams(['TARGET: 260', 'STOP: 235']);
    expect(params.targetPrice).toBe(260);
    expect(params.stopLoss).toBe(235);
  });

  it('skips non-numeric target/stop values gracefully', () => {
    const params = parseStructuredParams(['TARGET: around $260', 'STOP: depends on volatility']);
    // "around" causes parseFloat to return NaN for the first capture group
    expect(params.targetPrice).toBeUndefined();
    expect(params.stopLoss).toBeUndefined();
  });

  it('normalizes conviction case', () => {
    const params = parseStructuredParams(['CONVICTION: medium']);
    expect(params.conviction).toBe('MEDIUM');
  });

  it('rejects invalid conviction values', () => {
    const params = parseStructuredParams(['CONVICTION: Moderate to High']);
    // "Moderate" doesn't match LOW|MEDIUM|HIGH
    expect(params.conviction).toBeUndefined();
  });

  it('returns empty object when no params are present', () => {
    const params = parseStructuredParams(['## Why Now', 'The stock broke out above resistance...']);
    expect(params).toEqual({});
  });

  it('parses partial params (only some lines present)', () => {
    const params = parseStructuredParams(['ENTRY: $245-250', 'CONVICTION: LOW']);
    expect(params.entryRange).toBe('$245-250');
    expect(params.conviction).toBe('LOW');
    expect(params.targetPrice).toBeUndefined();
    expect(params.stopLoss).toBeUndefined();
    expect(params.horizon).toBeUndefined();
  });

  it('handles zero or negative prices', () => {
    const params = parseStructuredParams(['TARGET: $0', 'STOP: $-10']);
    // 0 is not > 0, -10 is not > 0
    expect(params.targetPrice).toBeUndefined();
    expect(params.stopLoss).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseActionResponse
// ---------------------------------------------------------------------------

describe('parseActionResponse', () => {
  const evaluation = makeEvaluation();

  it('parses full structured response with headline + params + reasoning', () => {
    const rawOutput = [
      'ACTION: BUY TSLA — AI5 chip milestone confirmed',
      'ENTRY: $245-250',
      'TARGET: $275',
      'STOP: $230',
      'HORIZON: 1-2 weeks',
      'CONVICTION: HIGH',
      '',
      '## Why Now',
      'The AI5 chip partnership confirmed by Tesla today.',
      '',
      '## Key Risks',
      'RSI is already at 72, overbought territory.',
    ].join('\n');

    const result = parseActionResponse(rawOutput, evaluation);

    expect(result.headline).toBe('BUY TSLA — AI5 chip milestone confirmed');
    expect(result.entryRange).toBe('$245-250');
    expect(result.targetPrice).toBe(275);
    expect(result.stopLoss).toBe(230);
    expect(result.horizon).toBe('1-2 weeks');
    expect(result.conviction).toBe('HIGH');
    // Structured param lines should be filtered OUT of reasoning
    expect(result.reasoning).not.toContain('ENTRY:');
    expect(result.reasoning).not.toContain('TARGET:');
    expect(result.reasoning).not.toContain('CONVICTION:');
    expect(result.reasoning).toContain('AI5 chip partnership');
    expect(result.reasoning).toContain('RSI is already at 72');
  });

  it('parses old-format response (no structured params)', () => {
    const rawOutput = [
      'ACTION: BUY TSLA — Extreme social sentiment surge warrants momentum long entry',
      '',
      '1. Why this trigger matters right now',
      'Social sentiment surged 330%, driven by AI5 chip news.',
      '',
      '2. Key risks',
      'RSI overbought at 72.',
    ].join('\n');

    const result = parseActionResponse(rawOutput, evaluation);

    expect(result.headline).toBe('BUY TSLA — Extreme social sentiment surge warrants momentum long entry');
    expect(result.entryRange).toBeUndefined();
    expect(result.targetPrice).toBeUndefined();
    expect(result.stopLoss).toBeUndefined();
    expect(result.horizon).toBeUndefined();
    expect(result.conviction).toBeUndefined();
    expect(result.reasoning).toContain('Social sentiment surged 330%');
  });

  it('falls back to REVIEW headline when ACTION: prefix missing', () => {
    const rawOutput = 'The stock looks interesting but I need more data.';
    const result = parseActionResponse(rawOutput, evaluation);

    expect(result.headline).toBe('REVIEW TSLA — Price moved +5.2%');
    expect(result.reasoning).toBe(rawOutput);
  });

  it('uses portfolio as ticker fallback when context has no ticker', () => {
    const evalNoTicker = makeEvaluation({
      context: { change: 0.052, threshold: 0.05 },
    });
    const rawOutput = 'Some unstructured response.';
    const result = parseActionResponse(rawOutput, evalNoTicker);

    expect(result.headline).toBe('REVIEW portfolio — Price moved +5.2%');
  });

  it('handles response with params but no reasoning text', () => {
    const rawOutput = [
      'ACTION: SELL TSLA — Breakdown below support',
      'ENTRY: at market',
      'TARGET: $200',
      'STOP: $260',
      'HORIZON: 2-3 days',
      'CONVICTION: MEDIUM',
    ].join('\n');

    const result = parseActionResponse(rawOutput, evaluation);

    expect(result.headline).toBe('SELL TSLA — Breakdown below support');
    expect(result.entryRange).toBe('at market');
    expect(result.targetPrice).toBe(200);
    expect(result.conviction).toBe('MEDIUM');
    // All lines are param lines, so reasoning should be empty
    expect(result.reasoning).toBe('');
  });
});
