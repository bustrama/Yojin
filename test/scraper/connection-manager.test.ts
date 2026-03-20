import { mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConnectionManager } from '../../src/scraper/connection-manager.js';
import type { ConnectionConfig, IntegrationTier, TieredPlatformConnector } from '../../src/scraper/types.js';
import { ConnectionConfigSchema, ConnectionsFileSchema, IntegrationTierSchema } from '../../src/scraper/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockConnector(platformId: string, tier: IntegrationTier, available = true): TieredPlatformConnector {
  return {
    platformId,
    platformName: `${platformId} (${tier})`,
    tier,
    isAvailable: vi.fn().mockResolvedValue(available),
    connect: vi.fn().mockResolvedValue({ success: true }),
    disconnect: vi.fn().mockResolvedValue(undefined),
    fetchPositions: vi.fn().mockResolvedValue({
      success: true,
      positions: [],
      metadata: {
        source: tier,
        platform: platformId,
        extractedAt: new Date().toISOString(),
        confidence: 1,
        positionConfidences: [],
        warnings: [],
      },
    }),
  };
}

function makeConfig(overrides: Partial<ConnectionConfig> = {}): ConnectionConfig {
  return ConnectionConfigSchema.parse({
    id: 'test-conn',
    platform: 'COINBASE',
    tier: 'api',
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe('ConnectionManager — registration', () => {
  let dataRoot: string;
  let manager: ConnectionManager;

  beforeEach(async () => {
    dataRoot = join(tmpdir(), `yojin-test-cm-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(dataRoot, 'config'), { recursive: true });
    manager = new ConnectionManager(dataRoot);
  });

  afterEach(async () => {
    await rm(dataRoot, { recursive: true, force: true });
  });

  it('registers a connector and resolves it', async () => {
    const connector = mockConnector('COINBASE', 'api');
    manager.registerConnector(connector);
    const resolved = await manager.resolveConnector('COINBASE');
    expect(resolved).toBe(connector);
  });

  it('throws on duplicate registration (same platform + tier)', () => {
    manager.registerConnector(mockConnector('COINBASE', 'api'));
    expect(() => manager.registerConnector(mockConnector('COINBASE', 'api'))).toThrow(
      /already registered.*COINBASE.*api/,
    );
  });

  it('registers multiple tiers for the same platform', async () => {
    manager.registerConnector(mockConnector('COINBASE', 'cli'));
    manager.registerConnector(mockConnector('COINBASE', 'api'));
    manager.registerConnector(mockConnector('COINBASE', 'screenshot'));

    const tiers = await manager.detectAvailableTiers('COINBASE');
    const available = tiers.filter((t) => t.available);
    expect(available).toHaveLength(3);
  });

  it('registers connectors for different platforms', async () => {
    manager.registerConnector(mockConnector('COINBASE', 'api'));
    manager.registerConnector(mockConnector('ROBINHOOD', 'ui'));

    const cb = await manager.resolveConnector('COINBASE');
    expect(cb.platformId).toBe('COINBASE');
    const rh = await manager.resolveConnector('ROBINHOOD');
    expect(rh.platformId).toBe('ROBINHOOD');
  });
});

// ---------------------------------------------------------------------------
// Tier detection
// ---------------------------------------------------------------------------

describe('ConnectionManager — tier detection', () => {
  let dataRoot: string;
  let manager: ConnectionManager;

  beforeEach(async () => {
    dataRoot = join(tmpdir(), `yojin-test-cm-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(dataRoot, 'config'), { recursive: true });
    manager = new ConnectionManager(dataRoot);
  });

  afterEach(async () => {
    await rm(dataRoot, { recursive: true, force: true });
  });

  it('returns correct availability for registered tiers', async () => {
    manager.registerConnector(mockConnector('COINBASE', 'api', true));
    manager.registerConnector(mockConnector('COINBASE', 'screenshot', true));

    const tiers = await manager.detectAvailableTiers('COINBASE');
    expect(tiers).toEqual([
      { tier: 'cli', available: false },
      { tier: 'api', available: true },
      { tier: 'ui', available: false },
      { tier: 'screenshot', available: true },
    ]);
  });

  it('returns all unavailable when no connectors registered', async () => {
    const tiers = await manager.detectAvailableTiers('UNKNOWN');
    expect(tiers.every((t) => !t.available)).toBe(true);
    expect(tiers).toHaveLength(4);
  });

  it('handles mixed availability', async () => {
    manager.registerConnector(mockConnector('COINBASE', 'cli', false));
    manager.registerConnector(mockConnector('COINBASE', 'api', true));

    const tiers = await manager.detectAvailableTiers('COINBASE');
    const cliTier = tiers.find((t) => t.tier === 'cli');
    const apiTier = tiers.find((t) => t.tier === 'api');
    expect(cliTier?.available).toBe(false);
    expect(apiTier?.available).toBe(true);
  });

  it('treats isAvailable() throwing as unavailable', async () => {
    const failing = mockConnector('COINBASE', 'api');
    (failing.isAvailable as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
    manager.registerConnector(failing);

    const tiers = await manager.detectAvailableTiers('COINBASE');
    const apiTier = tiers.find((t) => t.tier === 'api');
    expect(apiTier?.available).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Fallback / resolution
// ---------------------------------------------------------------------------

describe('ConnectionManager — resolver fallback', () => {
  let dataRoot: string;
  let manager: ConnectionManager;

  beforeEach(async () => {
    dataRoot = join(tmpdir(), `yojin-test-cm-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(dataRoot, 'config'), { recursive: true });
    manager = new ConnectionManager(dataRoot);
  });

  afterEach(async () => {
    await rm(dataRoot, { recursive: true, force: true });
  });

  it('returns highest-priority available tier', async () => {
    manager.registerConnector(mockConnector('COINBASE', 'cli', true));
    manager.registerConnector(mockConnector('COINBASE', 'api', true));
    manager.registerConnector(mockConnector('COINBASE', 'screenshot', true));

    const resolved = await manager.resolveConnector('COINBASE');
    expect(resolved.tier).toBe('cli');
  });

  it('falls back to lower tier when higher is unavailable', async () => {
    manager.registerConnector(mockConnector('COINBASE', 'cli', false));
    manager.registerConnector(mockConnector('COINBASE', 'api', true));

    const resolved = await manager.resolveConnector('COINBASE');
    expect(resolved.tier).toBe('api');
  });

  it('falls back to screenshot when all others unavailable', async () => {
    manager.registerConnector(mockConnector('COINBASE', 'cli', false));
    manager.registerConnector(mockConnector('COINBASE', 'api', false));
    manager.registerConnector(mockConnector('COINBASE', 'ui', false));
    manager.registerConnector(mockConnector('COINBASE', 'screenshot', true));

    const resolved = await manager.resolveConnector('COINBASE');
    expect(resolved.tier).toBe('screenshot');
  });

  it('throws when no connector is available', async () => {
    manager.registerConnector(mockConnector('COINBASE', 'api', false));

    await expect(manager.resolveConnector('COINBASE')).rejects.toThrow(/No available connector/);
  });

  it('throws when no connectors registered for platform', async () => {
    await expect(manager.resolveConnector('UNKNOWN')).rejects.toThrow(/No connectors registered/);
  });

  it('skips tiers where isAvailable throws', async () => {
    const failing = mockConnector('COINBASE', 'cli');
    (failing.isAvailable as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
    manager.registerConnector(failing);
    manager.registerConnector(mockConnector('COINBASE', 'api', true));

    const resolved = await manager.resolveConnector('COINBASE');
    expect(resolved.tier).toBe('api');
  });
});

// ---------------------------------------------------------------------------
// Connection CRUD
// ---------------------------------------------------------------------------

describe('ConnectionManager — CRUD', () => {
  let dataRoot: string;
  let manager: ConnectionManager;

  beforeEach(async () => {
    dataRoot = join(tmpdir(), `yojin-test-cm-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(dataRoot, 'config'), { recursive: true });
    manager = new ConnectionManager(dataRoot);
  });

  afterEach(async () => {
    await rm(dataRoot, { recursive: true, force: true });
  });

  it('addConnection persists and can be listed', async () => {
    const config = makeConfig();
    await manager.addConnection(config);

    const list = manager.listConnections();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('test-conn');
  });

  it('addConnection rejects duplicate id', async () => {
    await manager.addConnection(makeConfig());
    await expect(manager.addConnection(makeConfig())).rejects.toThrow(/already exists/);
  });

  it('removeConnection removes and persists', async () => {
    await manager.addConnection(makeConfig({ id: 'a' }));
    await manager.addConnection(makeConfig({ id: 'b' }));

    await manager.removeConnection('a');
    const list = manager.listConnections();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('b');
  });

  it('removeConnection handles non-existent id gracefully', async () => {
    await expect(manager.removeConnection('nope')).resolves.toBeUndefined();
  });

  it('listConnections throws before loadConnections', () => {
    expect(() => manager.listConnections()).toThrow(/call loadConnections/);
  });

  it('persists to disk as valid JSON', async () => {
    await manager.addConnection(makeConfig());

    const raw = await readFile(join(dataRoot, 'config', 'connections.json'), 'utf-8');
    const parsed = ConnectionsFileSchema.parse(JSON.parse(raw));
    expect(parsed.connections).toHaveLength(1);
  });

  it('loadConnections reads from disk', async () => {
    await manager.addConnection(makeConfig({ id: 'persisted' }));

    const manager2 = new ConnectionManager(dataRoot);
    await manager2.loadConnections();
    const list = manager2.listConnections();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('persisted');
  });

  it('loadConnections defaults to empty when file missing', async () => {
    await manager.loadConnections();
    expect(manager.listConnections()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

describe('ConnectionConfig schema', () => {
  it('applies defaults for optional fields', () => {
    const config = ConnectionConfigSchema.parse({
      id: 'test',
      platform: 'COINBASE',
      tier: 'api',
    });

    expect(config.enabled).toBe(true);
    expect(config.credentialRefs).toEqual([]);
    expect(config.syncInterval).toBe(3600);
    expect(config.lastSync).toBeNull();
    expect(config.status).toBe('pending');
    expect(config.autoRefresh).toBe(true);
  });

  it('rejects invalid tier values', () => {
    const result = ConnectionConfigSchema.safeParse({
      id: 'test',
      platform: 'COINBASE',
      tier: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    expect(ConnectionConfigSchema.safeParse({}).success).toBe(false);
    expect(ConnectionConfigSchema.safeParse({ id: 'test' }).success).toBe(false);
  });
});

describe('IntegrationTierSchema', () => {
  it('accepts all valid tiers', () => {
    for (const tier of ['cli', 'api', 'ui', 'screenshot']) {
      expect(IntegrationTierSchema.parse(tier)).toBe(tier);
    }
  });

  it('rejects invalid tier', () => {
    expect(IntegrationTierSchema.safeParse('grpc').success).toBe(false);
  });
});

describe('ConnectionsFileSchema', () => {
  it('defaults to empty connections array', () => {
    const file = ConnectionsFileSchema.parse({});
    expect(file.connections).toEqual([]);
  });

  it('validates nested connection configs', () => {
    const file = ConnectionsFileSchema.parse({
      connections: [
        { id: 'a', platform: 'COINBASE', tier: 'api' },
        { id: 'b', platform: 'ROBINHOOD', tier: 'ui' },
      ],
    });
    expect(file.connections).toHaveLength(2);
    expect(file.connections[0].enabled).toBe(true); // default applied
  });
});
