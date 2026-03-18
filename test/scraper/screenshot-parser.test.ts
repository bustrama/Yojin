import { describe, expect, it, vi } from 'vitest';

import type { AgentLoopProvider } from '../../src/core/types.js';
import { ScreenshotConnector } from '../../src/scraper/platforms/screenshot-connector.js';
import {
  buildExtractionPrompt,
  computeConfidence,
  extractJsonFromResponse,
  parsePortfolioScreenshot,
} from '../../src/scraper/screenshot-parser.js';
import type { ExtractedPosition } from '../../src/scraper/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockProvider(responseText: string): AgentLoopProvider {
  return {
    completeWithTools: vi.fn(async () => ({
      content: [{ type: 'text' as const, text: responseText }],
      stopReason: 'end_turn',
      usage: { inputTokens: 1000, outputTokens: 500 },
    })),
  };
}

function mockErrorProvider(error: string): AgentLoopProvider {
  return {
    completeWithTools: vi.fn(async () => {
      throw new Error(error);
    }),
  };
}

const VALID_RESPONSE = JSON.stringify({
  platform: 'COINBASE',
  positions: [
    {
      symbol: 'BTC',
      name: 'Bitcoin',
      quantity: 0.5,
      costBasis: 29000,
      currentPrice: 67234,
      marketValue: 33617,
      unrealizedPnl: 4617,
      unrealizedPnlPercent: 15.9,
      assetClass: 'CRYPTO',
    },
    {
      symbol: 'ETH',
      name: 'Ethereum',
      quantity: 12,
      currentPrice: 3456,
      marketValue: 41472,
      assetClass: 'CRYPTO',
    },
  ],
});

const DUMMY_IMAGE = Buffer.from('fake-image-data');

// ---------------------------------------------------------------------------
// extractJsonFromResponse
// ---------------------------------------------------------------------------

describe('extractJsonFromResponse', () => {
  it('parses raw JSON', () => {
    const result = extractJsonFromResponse('{"platform":"COINBASE","positions":[]}');
    expect(result).toEqual({ platform: 'COINBASE', positions: [] });
  });

  it('parses markdown-fenced JSON', () => {
    const text = 'Here is the data:\n```json\n{"platform":"ROBINHOOD","positions":[]}\n```';
    const result = extractJsonFromResponse(text);
    expect(result).toEqual({ platform: 'ROBINHOOD', positions: [] });
  });

  it('parses fenced JSON without language tag', () => {
    const text = '```\n{"platform":"MANUAL","positions":[]}\n```';
    const result = extractJsonFromResponse(text);
    expect(result).toEqual({ platform: 'MANUAL', positions: [] });
  });

  it('extracts JSON object embedded in text', () => {
    const text = 'I found the following:\n{"platform":"COINBASE","positions":[{"symbol":"BTC"}]}\nEnd of data.';
    const result = extractJsonFromResponse(text);
    expect(result).toEqual({ platform: 'COINBASE', positions: [{ symbol: 'BTC' }] });
  });

  it('returns null for non-JSON text', () => {
    expect(extractJsonFromResponse('No JSON here at all')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(extractJsonFromResponse('{invalid json}')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computeConfidence
// ---------------------------------------------------------------------------

describe('computeConfidence', () => {
  it('returns high confidence for a fully populated position', () => {
    const positions: ExtractedPosition[] = [
      {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        quantity: 10,
        costBasis: 150,
        currentPrice: 175,
        marketValue: 1750,
        unrealizedPnl: 250,
        unrealizedPnlPercent: 16.67,
      },
    ];
    const { overall, perPosition } = computeConfidence(positions);
    expect(overall).toBe(1);
    expect(perPosition[0].fieldsExtracted).toBe(7);
    expect(perPosition[0].consistencyCheck).toBe(true);
  });

  it('returns lower confidence for a partial position', () => {
    const positions: ExtractedPosition[] = [
      {
        symbol: 'BTC',
        currentPrice: 67000,
      },
    ];
    const { overall, perPosition } = computeConfidence(positions);
    expect(overall).toBeLessThan(0.5);
    expect(perPosition[0].fieldsExtracted).toBe(1);
    expect(perPosition[0].consistencyCheck).toBe(true); // Can't check, assumed true
  });

  it('fails consistency check when values are inconsistent', () => {
    const positions: ExtractedPosition[] = [
      {
        symbol: 'TSLA',
        name: 'Tesla',
        quantity: 10,
        currentPrice: 250,
        marketValue: 5000, // Should be 2500, way off
        unrealizedPnl: 100,
        unrealizedPnlPercent: 5,
        costBasis: 240,
      },
    ];
    const { perPosition } = computeConfidence(positions);
    expect(perPosition[0].consistencyCheck).toBe(false);
    expect(perPosition[0].confidence).toBe(0.7); // 7/7 completeness * 0.7 + 0 consistency * 0.3
  });

  it('passes consistency check within tolerance', () => {
    const positions: ExtractedPosition[] = [
      {
        symbol: 'GOOG',
        quantity: 5,
        currentPrice: 150,
        marketValue: 748, // 5 * 150 = 750, diff = 0.27%, within 5%
      },
    ];
    const { perPosition } = computeConfidence(positions);
    expect(perPosition[0].consistencyCheck).toBe(true);
  });

  it('returns 0 overall for empty array', () => {
    const { overall } = computeConfidence([]);
    expect(overall).toBe(0);
  });

  it('averages confidence across multiple positions', () => {
    const positions: ExtractedPosition[] = [
      {
        symbol: 'BTC',
        name: 'Bitcoin',
        quantity: 1,
        costBasis: 30000,
        currentPrice: 67000,
        marketValue: 67000,
        unrealizedPnl: 37000,
        unrealizedPnlPercent: 123,
      },
      {
        symbol: 'DOGE',
        currentPrice: 0.15,
      },
    ];
    const { overall, perPosition } = computeConfidence(positions);
    expect(perPosition[0].confidence).toBe(1); // Full + consistent
    expect(perPosition[1].confidence).toBeLessThan(0.5); // Partial
    expect(overall).toBeGreaterThan(0.5);
    expect(overall).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// buildExtractionPrompt
// ---------------------------------------------------------------------------

describe('buildExtractionPrompt', () => {
  it('includes platform hint when provided', () => {
    const prompt = buildExtractionPrompt('COINBASE');
    expect(prompt).toContain('COINBASE');
    expect(prompt).toContain('user indicated');
  });

  it('asks for platform detection when no hint', () => {
    const prompt = buildExtractionPrompt();
    expect(prompt).toContain('Identify the platform');
  });
});

// ---------------------------------------------------------------------------
// parsePortfolioScreenshot
// ---------------------------------------------------------------------------

describe('parsePortfolioScreenshot', () => {
  it('successfully parses a valid vision response', async () => {
    const provider = mockProvider(VALID_RESPONSE);

    const result = await parsePortfolioScreenshot({
      imageData: DUMMY_IMAGE,
      mediaType: 'image/png',
      provider,
      model: 'claude-sonnet-4-6',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.positions).toHaveLength(2);
    expect(result.positions[0].symbol).toBe('BTC');
    expect(result.positions[1].symbol).toBe('ETH');
    expect(result.metadata.platform).toBe('COINBASE');
    expect(result.metadata.source).toBe('screenshot');
    expect(result.metadata.confidence).toBeGreaterThan(0);
    expect(result.metadata.usage).toEqual({ inputTokens: 1000, outputTokens: 500 });
  });

  it('sends image as base64 in the message', async () => {
    const provider = mockProvider(VALID_RESPONSE);

    await parsePortfolioScreenshot({
      imageData: DUMMY_IMAGE,
      mediaType: 'image/jpeg',
      provider,
      model: 'claude-sonnet-4-6',
    });

    const call = vi.mocked(provider.completeWithTools).mock.calls[0][0];
    const userMessage = call.messages[0];
    expect(Array.isArray(userMessage.content)).toBe(true);

    const blocks = userMessage.content as Array<{ type: string; source?: unknown }>;
    const imageBlock = blocks.find((b) => b.type === 'image');
    expect(imageBlock).toBeDefined();
    expect(imageBlock!.source).toEqual({
      type: 'base64',
      media_type: 'image/jpeg',
      data: DUMMY_IMAGE.toString('base64'),
    });
  });

  it('returns failure when provider throws', async () => {
    const provider = mockErrorProvider('API rate limited');

    const result = await parsePortfolioScreenshot({
      imageData: DUMMY_IMAGE,
      mediaType: 'image/png',
      provider,
      model: 'claude-sonnet-4-6',
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('Vision API call failed');
    expect(result.error).toContain('API rate limited');
  });

  it('returns failure for non-JSON response', async () => {
    const provider = mockProvider('I cannot read this image clearly.');

    const result = await parsePortfolioScreenshot({
      imageData: DUMMY_IMAGE,
      mediaType: 'image/png',
      provider,
      model: 'claude-sonnet-4-6',
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('Could not extract JSON');
  });

  it('returns failure for invalid JSON structure', async () => {
    const provider = mockProvider(JSON.stringify({ platform: 'COINBASE' })); // missing positions

    const result = await parsePortfolioScreenshot({
      imageData: DUMMY_IMAGE,
      mediaType: 'image/png',
      provider,
      model: 'claude-sonnet-4-6',
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('Validation failed');
  });

  it('returns failure for empty response', async () => {
    const provider = mockProvider('');

    const result = await parsePortfolioScreenshot({
      imageData: DUMMY_IMAGE,
      mediaType: 'image/png',
      provider,
      model: 'claude-sonnet-4-6',
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('empty response');
  });

  it('includes warnings for incomplete positions', async () => {
    const response = JSON.stringify({
      platform: 'ROBINHOOD',
      positions: [{ symbol: 'SOL', currentPrice: 150 }],
      notes: 'Could not read cost basis for SOL',
    });
    const provider = mockProvider(response);

    const result = await parsePortfolioScreenshot({
      imageData: DUMMY_IMAGE,
      mediaType: 'image/png',
      provider,
      model: 'claude-sonnet-4-6',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.metadata.warnings).toContain('Could not read cost basis for SOL');
    expect(result.metadata.warnings.some((w) => w.includes('Incomplete data for SOL'))).toBe(true);
  });

  it('passes platform hint to the prompt', async () => {
    const provider = mockProvider(VALID_RESPONSE);

    await parsePortfolioScreenshot({
      imageData: DUMMY_IMAGE,
      mediaType: 'image/png',
      provider,
      model: 'claude-sonnet-4-6',
      platformHint: 'INTERACTIVE_BROKERS',
    });

    const call = vi.mocked(provider.completeWithTools).mock.calls[0][0];
    const blocks = call.messages[0].content as Array<{ type: string; text?: string }>;
    const textBlock = blocks.find((b) => b.type === 'text');
    expect(textBlock?.text).toContain('INTERACTIVE BROKERS');
  });

  it('handles markdown-fenced JSON from vision', async () => {
    const fenced = '```json\n' + VALID_RESPONSE + '\n```';
    const provider = mockProvider(fenced);

    const result = await parsePortfolioScreenshot({
      imageData: DUMMY_IMAGE,
      mediaType: 'image/png',
      provider,
      model: 'claude-sonnet-4-6',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.positions).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// ScreenshotConnector
// ---------------------------------------------------------------------------

describe('ScreenshotConnector', () => {
  it('delegates fetchPositions to parsePortfolioScreenshot', async () => {
    const provider = mockProvider(VALID_RESPONSE);
    const connector = new ScreenshotConnector({
      imageData: DUMMY_IMAGE,
      mediaType: 'image/png',
      provider,
      model: 'claude-sonnet-4-6',
    });

    expect(connector.platformId).toBe('screenshot');
    expect(connector.platformName).toBe('Screenshot Import');

    const result = await connector.fetchPositions();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.positions).toHaveLength(2);
  });

  it('returns failure when provider errors', async () => {
    const provider = mockErrorProvider('Network error');
    const connector = new ScreenshotConnector({
      imageData: DUMMY_IMAGE,
      mediaType: 'image/png',
      provider,
      model: 'claude-sonnet-4-6',
    });

    const result = await connector.fetchPositions();
    expect(result.success).toBe(false);
  });
});
