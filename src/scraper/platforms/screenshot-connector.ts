/**
 * Screenshot connector — wraps the screenshot parser as a PlatformConnector.
 *
 * Instantiated per-import: each screenshot creates a new connector instance.
 * The connector is stateless — no auth, no session, always available.
 */

import type { Platform } from '../../api/graphql/types.js';
import type { AgentLoopProvider } from '../../core/types.js';
import { parsePortfolioScreenshot } from '../screenshot-parser.js';
import type { PlatformConnector, PlatformConnectorResult } from '../types.js';

export interface ScreenshotConnectorParams {
  imageData: Buffer;
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  provider: AgentLoopProvider;
  model: string;
  platformHint?: Platform;
  /** Max tokens for the vision response (default 4096). */
  maxTokens?: number;
}

export class ScreenshotConnector implements PlatformConnector {
  readonly platformId = 'screenshot';
  readonly platformName = 'Screenshot Import';

  constructor(private readonly params: ScreenshotConnectorParams) {}

  async fetchPositions(): Promise<PlatformConnectorResult> {
    return parsePortfolioScreenshot(this.params);
  }
}
