import { describe, expect, it } from 'vitest';

import { SELF_INVALIDATING_RE } from '../../src/signals/quality-patterns.js';

describe('SELF_INVALIDATING_RE', () => {
  const shouldMatch = [
    'lacks independent verification',
    'lacks verification',
    'unverified claim from a Reddit user',
    'the thesis remains speculative without further data',
    'remain speculative given the limited data',
    'relies on anecdotal observation rather than company guidance',
    'rely on anecdotal evidence',
    'no independent confirmation from management',
    'no confirmation from the company',
    'cannot be verified through public filings',
    'cannot be substantiated by available data',
    'cannot be corroborated by official sources',
    'self-reported and unverified metrics',
    'self-reported unverified data',
    'no supporting evidence beyond the original post',
    'no evidence to support the claim',
    "based on a single user's observation of website traffic",
    "based on one person's claim about SEO data",
  ];

  const shouldNotMatch = [
    'AAPL beats Q3 estimates with $94.9B revenue',
    'FDA approves new drug application for BIIB',
    'analyst upgrades price target to $200',
    'company confirmed the acquisition in an SEC filing',
    'verified by multiple independent sources',
    'quarterly results show 15% revenue growth',
    'Morgan Stanley initiates coverage with Overweight rating',
  ];

  for (const text of shouldMatch) {
    it(`matches: "${text}"`, () => {
      expect(SELF_INVALIDATING_RE.test(text)).toBe(true);
    });
  }

  for (const text of shouldNotMatch) {
    it(`does not match: "${text}"`, () => {
      expect(SELF_INVALIDATING_RE.test(text)).toBe(false);
    });
  }
});
