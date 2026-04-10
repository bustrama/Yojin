import { describe, expect, it } from 'vitest';

import { deriveCuratedOutputType, deriveSignalSeverity } from '../../../src/api/graphql/resolvers/curated-signals.js';
import type { SignalAssessment } from '../../../src/signals/curation/assessment-types.js';
import type { Signal } from '../../../src/signals/types.js';

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: 'sig-1',
    contentHash: 'hash-1',
    type: 'NEWS',
    title: 'Test signal',
    content: 'Test content',
    assets: [{ ticker: 'AAPL', relevance: 0.8, linkType: 'DIRECT' }],
    sources: [{ id: 'src-1', name: 'Source', type: 'RSS', reliability: 0.8 }],
    publishedAt: '2026-04-01T10:00:00.000Z',
    ingestedAt: '2026-04-01T10:05:00.000Z',
    confidence: 0.6,
    outputType: 'INSIGHT',
    version: 1,
    ...overrides,
  };
}

function makeAssessment(overrides: Partial<SignalAssessment> = {}): SignalAssessment {
  return {
    signalId: 'sig-1',
    ticker: 'AAPL',
    verdict: 'IMPORTANT',
    relevanceScore: 0.8,
    reasoning: 'Material change',
    thesisAlignment: 'NEUTRAL',
    actionability: 0.5,
    ...overrides,
  };
}

describe('deriveSignalSeverity', () => {
  it('requires both importance and urgency for CRITICAL severity', () => {
    const severity = deriveSignalSeverity(
      makeSignal({ publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() }),
      makeAssessment({ verdict: 'CRITICAL', relevanceScore: 0.95, actionability: 0.9 }),
    );
    expect(severity).toBe('CRITICAL');
  });

  it('marks important thesis-challenging signals as HIGH severity', () => {
    const severity = deriveSignalSeverity(
      makeSignal({ publishedAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString() }),
      makeAssessment({ verdict: 'IMPORTANT', relevanceScore: 0.76, thesisAlignment: 'CHALLENGES', actionability: 0.6 }),
    );
    expect(severity).toBe('HIGH');
  });

  it('downgrades important but less urgent signals to MEDIUM', () => {
    const severity = deriveSignalSeverity(
      makeSignal({ publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() }),
      makeAssessment({ verdict: 'IMPORTANT', relevanceScore: 0.6, thesisAlignment: 'NEUTRAL', actionability: 0.25 }),
    );
    expect(severity).toBe('MEDIUM');
  });

  it('keeps stale low-urgency assessed signals at LOW', () => {
    const severity = deriveSignalSeverity(
      makeSignal({ publishedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() }),
      makeAssessment({ verdict: 'IMPORTANT', relevanceScore: 0.3, thesisAlignment: 'NEUTRAL', actionability: 0.1 }),
    );
    expect(severity).toBe('LOW');
  });

  it('uses explicit metadata severity when no assessment exists', () => {
    const severity = deriveSignalSeverity(makeSignal({ metadata: { severity: 'HIGH' } }), null);
    expect(severity).toBe('HIGH');
  });

  it('treats fresh alert signals as HIGH severity even without assessment', () => {
    const severity = deriveSignalSeverity(
      makeSignal({
        outputType: 'ALERT',
        confidence: 0.7,
        publishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      }),
      null,
    );
    expect(severity).toBe('HIGH');
  });

  it('falls back to LOW for routine low-confidence insights', () => {
    const severity = deriveSignalSeverity(makeSignal({ confidence: 0.45 }), null);
    expect(severity).toBe('LOW');
  });
});

describe('deriveCuratedOutputType', () => {
  it('promotes high-severity curated signals to ALERT', () => {
    const outputType = deriveCuratedOutputType(
      makeSignal({ publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() }),
      makeAssessment({ verdict: 'CRITICAL', relevanceScore: 0.95, actionability: 0.9 }),
    );
    expect(outputType).toBe('ALERT');
  });

  it('keeps lower-severity curated signals as INSIGHT', () => {
    const outputType = deriveCuratedOutputType(
      makeSignal({ publishedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() }),
      makeAssessment({ verdict: 'IMPORTANT', relevanceScore: 0.3, actionability: 0.1 }),
    );
    expect(outputType).toBe('INSIGHT');
  });

  it('preserves SUMMARY output types', () => {
    const outputType = deriveCuratedOutputType(makeSignal({ outputType: 'SUMMARY' }), null);
    expect(outputType).toBe('SUMMARY');
  });
});
