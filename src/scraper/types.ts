/**
 * Scraper domain types — interfaces for platform connectors,
 * tiered connector framework, and screenshot extraction results.
 */

import { z } from 'zod';

import type { Platform } from '../api/graphql/types.js';
import { AssetClassSchema, PlatformSchema } from '../api/graphql/types.js';
import type { AgentLoopProvider, ImageMediaType } from '../core/types.js';

export { AssetClassSchema, PlatformSchema };

// ---------------------------------------------------------------------------
// Integration tiers (priority order: cli > api > ui > screenshot)
// ---------------------------------------------------------------------------

export const IntegrationTierSchema = z.enum(['cli', 'api', 'ui', 'screenshot']);
export type IntegrationTier = z.infer<typeof IntegrationTierSchema>;

export const ExtractedPositionSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().optional(),
  quantity: z.number().optional(),
  costBasis: z.number().optional(),
  currentPrice: z.number().optional(),
  marketValue: z.number().optional(),
  unrealizedPnl: z.number().optional(),
  unrealizedPnlPercent: z.number().optional(),
  assetClass: AssetClassSchema.optional(),
});

export type ExtractedPosition = z.infer<typeof ExtractedPositionSchema>;

export const ExtractionResponseSchema = z.object({
  platform: PlatformSchema,
  positions: z.array(ExtractedPositionSchema),
  notes: z.string().optional(),
});

export type ExtractionResponse = z.infer<typeof ExtractionResponseSchema>;

// ---------------------------------------------------------------------------
// Platform connector interfaces
// ---------------------------------------------------------------------------

export interface PlatformConnector {
  readonly platformId: string;
  readonly platformName: string;
  fetchPositions(): Promise<PlatformConnectorResult>;
}

export interface TieredPlatformConnector extends PlatformConnector {
  readonly tier: IntegrationTier;
  isAvailable(): Promise<boolean>;
  connect(credentialRefs: string[]): Promise<{ success: boolean; error?: string }>;
  disconnect(): Promise<void>;
}

export type PlatformConnectorResult =
  | { success: true; positions: ExtractedPosition[]; metadata: ExtractionMetadata }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Screenshot parser params
// ---------------------------------------------------------------------------

export interface ParseScreenshotParams {
  imageData: Buffer;
  mediaType: ImageMediaType;
  provider: AgentLoopProvider;
  model: string;
  platformHint?: Platform;
  /** Max tokens for the vision response (default 4096). */
  maxTokens?: number;
}

// ---------------------------------------------------------------------------
// Extraction metadata and confidence scoring
// ---------------------------------------------------------------------------

export interface ExtractionMetadata {
  source: IntegrationTier;
  platform: Platform;
  extractedAt: string;
  confidence: number;
  positionConfidences: PositionConfidence[];
  warnings: string[];
  usage?: { inputTokens: number; outputTokens: number };
}

export interface PositionConfidence {
  symbol: string;
  confidence: number;
  fieldsExtracted: number;
  fieldsExpected: number;
  consistencyCheck: boolean;
}

// ---------------------------------------------------------------------------
// Screenshot parse result (Result-style, reuses PlatformConnectorResult)
// ---------------------------------------------------------------------------

export type ScreenshotParseResult = PlatformConnectorResult;

// ---------------------------------------------------------------------------
// Connection config (persisted in data/config/connections.json)
// ---------------------------------------------------------------------------

export const ConnectionStatusSchema = z.enum(['pending', 'connected', 'error', 'disconnected']);
export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;

export const ConnectionConfigSchema = z.object({
  id: z.string(),
  platform: z.string(),
  tier: IntegrationTierSchema,
  enabled: z.boolean().default(true),
  credentialRefs: z.array(z.string()).default([]),
  syncInterval: z.number().default(3600),
  lastSync: z.string().nullable().default(null),
  status: ConnectionStatusSchema.default('pending'),
  autoRefresh: z.boolean().default(true),
});
export type ConnectionConfig = z.infer<typeof ConnectionConfigSchema>;

export const ConnectionsFileSchema = z.object({
  connections: z.array(ConnectionConfigSchema).default([]),
});
export type ConnectionsFile = z.infer<typeof ConnectionsFileSchema>;
