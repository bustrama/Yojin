/**
 * Screenshot connector — wraps the screenshot parser as a TieredPlatformConnector.
 *
 * Instantiated per-import: each screenshot creates a new connector instance.
 * The connector is stateless — no auth, no session, always available.
 */

import { parsePortfolioScreenshot } from '../screenshot-parser.js';
import type {
  IntegrationTier,
  ParseScreenshotParams,
  PlatformConnectorResult,
  TieredPlatformConnector,
} from '../types.js';

export class ScreenshotConnector implements TieredPlatformConnector {
  readonly platformId = 'screenshot';
  readonly platformName = 'Screenshot Import';
  readonly tier: IntegrationTier = 'screenshot';

  constructor(private readonly params: ParseScreenshotParams) {}

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async connect(_credentialRefs: string[]): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  async disconnect(): Promise<void> {
    // No-op — stateless connector
  }

  async fetchPositions(): Promise<PlatformConnectorResult> {
    return parsePortfolioScreenshot(this.params);
  }
}
