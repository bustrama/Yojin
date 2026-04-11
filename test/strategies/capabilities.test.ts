import { describe, expect, it } from 'vitest';

import {
  DataCapabilitySchema,
  checkCapabilities,
  getAvailableCapabilities,
} from '../../src/strategies/capabilities.js';

describe('DataCapabilitySchema', () => {
  it('validates known capabilities', () => {
    expect(DataCapabilitySchema.parse('market_data')).toBe('market_data');
    expect(DataCapabilitySchema.parse('technicals')).toBe('technicals');
    expect(DataCapabilitySchema.parse('sentiment')).toBe('sentiment');
  });

  it('rejects unknown capabilities', () => {
    expect(() => DataCapabilitySchema.parse('options_chain')).toThrow();
    expect(() => DataCapabilitySchema.parse('')).toThrow();
  });
});

describe('getAvailableCapabilities', () => {
  it('returns a non-empty array of valid capabilities', () => {
    const available = getAvailableCapabilities();
    expect(available.length).toBeGreaterThan(0);
    for (const cap of available) {
      expect(() => DataCapabilitySchema.parse(cap)).not.toThrow();
    }
  });
});

describe('checkCapabilities', () => {
  it('returns all available when requires is empty', () => {
    const result = checkCapabilities([]);
    expect(result.status).toBe('executable');
    expect(result.missing).toEqual([]);
  });

  it('returns executable when all required are available', () => {
    const result = checkCapabilities(['market_data', 'technicals']);
    expect(result.status).toBe('executable');
    expect(result.missing).toEqual([]);
    expect(result.required).toEqual(['market_data', 'technicals']);
  });

  it('returns limited when some required are missing', () => {
    const subset = ['market_data'] as const;
    const result = checkCapabilities(['market_data', 'derivatives'], [...subset]);
    expect(result.status).toBe('limited');
    expect(result.missing).toEqual(['derivatives']);
  });

  it('returns unavailable when all required are missing', () => {
    const subset = ['market_data'] as const;
    const result = checkCapabilities(['derivatives'], [...subset]);
    expect(result.status).toBe('unavailable');
    expect(result.missing).toEqual(['derivatives']);
  });
});
