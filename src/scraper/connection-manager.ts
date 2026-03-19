/**
 * Connection manager — registers tiered connectors per platform,
 * detects available tiers, manages connection configs, and resolves
 * the best available connector with automatic fallback.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { ConnectionConfig, ConnectionsFile, IntegrationTier, TieredPlatformConnector } from './types.js';
import { ConnectionConfigSchema, ConnectionsFileSchema } from './types.js';
import { loadJsonConfig } from '../config/config.js';
import { createSubsystemLogger } from '../logging/logger.js';

const logger = createSubsystemLogger('connection-manager');

/** Tier priority — highest reliability first. */
const TIER_PRIORITY: IntegrationTier[] = ['cli', 'api', 'ui', 'screenshot'];

export class ConnectionManager {
  private connectors = new Map<string, TieredPlatformConnector[]>();
  private connections: ConnectionConfig[] = [];
  private loaded = false;
  private readonly configPath: string;

  constructor(dataRoot: string) {
    this.configPath = join(dataRoot, 'config', 'connections.json');
  }

  // -------------------------------------------------------------------------
  // Connector registration
  // -------------------------------------------------------------------------

  registerConnector(connector: TieredPlatformConnector): void {
    const existing = this.connectors.get(connector.platformId) ?? [];
    const duplicate = existing.find((c) => c.tier === connector.tier);
    if (duplicate) {
      throw new Error(`Connector already registered for ${connector.platformId} tier ${connector.tier}`);
    }
    existing.push(connector);
    this.connectors.set(connector.platformId, existing);
    logger.debug(`Registered ${connector.tier} connector for ${connector.platformId}`);
  }

  // -------------------------------------------------------------------------
  // Tier detection
  // -------------------------------------------------------------------------

  async detectAvailableTiers(platform: string): Promise<{ tier: IntegrationTier; available: boolean }[]> {
    const registered = this.connectors.get(platform) ?? [];
    const results: { tier: IntegrationTier; available: boolean }[] = [];

    for (const tier of TIER_PRIORITY) {
      const connector = registered.find((c) => c.tier === tier);
      if (!connector) {
        results.push({ tier, available: false });
        continue;
      }
      try {
        const available = await connector.isAvailable();
        results.push({ tier, available });
      } catch (err) {
        logger.warn(`isAvailable() threw for ${platform}/${tier}`, { error: err });
        results.push({ tier, available: false });
      }
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Connector resolution (with fallback)
  // -------------------------------------------------------------------------

  async resolveConnector(platform: string): Promise<TieredPlatformConnector> {
    const registered = this.connectors.get(platform);
    if (!registered || registered.length === 0) {
      throw new Error(`No connectors registered for platform ${platform}`);
    }

    const errors: string[] = [];

    for (const tier of TIER_PRIORITY) {
      const connector = registered.find((c) => c.tier === tier);
      if (!connector) continue;

      try {
        const available = await connector.isAvailable();
        if (available) return connector;
        errors.push(`${tier}: not available`);
      } catch (err) {
        errors.push(`${tier}: ${(err as Error).message}`);
      }
    }

    throw new Error(`No available connector for ${platform}. Tried: ${errors.join('; ')}`);
  }

  // -------------------------------------------------------------------------
  // Connection CRUD (persisted to connections.json)
  // -------------------------------------------------------------------------

  async loadConnections(): Promise<void> {
    const file = (await loadJsonConfig(this.configPath, ConnectionsFileSchema)) as ConnectionsFile;
    this.connections = file.connections;
    this.loaded = true;
    logger.debug(`Loaded ${this.connections.length} connection(s)`);
  }

  /** Ensure connections are loaded before any mutation to prevent data loss. */
  private async ensureLoaded(): Promise<void> {
    if (!this.loaded) {
      await this.loadConnections();
    }
  }

  listConnections(): ConnectionConfig[] {
    return [...this.connections];
  }

  async addConnection(config: ConnectionConfig): Promise<void> {
    await this.ensureLoaded();
    const parsed = ConnectionConfigSchema.parse(config);
    const existing = this.connections.find((c) => c.id === parsed.id);
    if (existing) {
      throw new Error(`Connection with id "${parsed.id}" already exists`);
    }
    this.connections.push(parsed);
    await this.persist();
    logger.info(`Added connection ${parsed.id} (${parsed.platform}/${parsed.tier})`);
  }

  async removeConnection(id: string): Promise<void> {
    await this.ensureLoaded();
    const index = this.connections.findIndex((c) => c.id === id);
    if (index === -1) {
      logger.warn(`Connection "${id}" not found — nothing to remove`);
      return;
    }
    this.connections.splice(index, 1);
    await this.persist();
    logger.info(`Removed connection ${id}`);
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  private async persist(): Promise<void> {
    await mkdir(dirname(this.configPath), { recursive: true });
    const data = JSON.stringify({ connections: this.connections }, null, 2);
    await writeFile(this.configPath, data, 'utf-8');
  }
}
