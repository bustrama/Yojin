import { describe, expect, it } from 'vitest';

import type { ConnectionManager } from '../../../src/scraper/connection-manager.js';
import { registerAllConnectors } from '../../../src/scraper/platforms/index.js';
import type { SecretVault } from '../../../src/trust/vault/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockVault(): SecretVault {
  return {
    async set() {},
    async get() {
      return '';
    },
    async has() {
      return false;
    },
    async list() {
      return [];
    },
    async delete() {},
  };
}

function makeMockManager(): ConnectionManager & {
  registered: Array<{ platformId: string; tier: string }>;
} {
  const registered: Array<{ platformId: string; tier: string }> = [];
  return {
    registered,
    registerConnector(connector: { platformId: string; tier: string }) {
      registered.push({ platformId: connector.platformId, tier: connector.tier });
    },
  } as ConnectionManager & { registered: Array<{ platformId: string; tier: string }> };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerAllConnectors', () => {
  it('registers all API-tier connectors without a browser', () => {
    const manager = makeMockManager();
    const vault = makeMockVault();

    registerAllConnectors({ manager, vault });

    const apiConnectors = manager.registered.filter((c) => c.tier === 'API');
    expect(apiConnectors).toHaveLength(4);

    const platforms = apiConnectors.map((c) => c.platformId);
    expect(platforms).toContain('COINBASE');
    expect(platforms).toContain('BINANCE');
    expect(platforms).toContain('INTERACTIVE_BROKERS');
    expect(platforms).toContain('POLYMARKET');
  });

  it('does not register UI-tier connectors without a browser', () => {
    const manager = makeMockManager();
    registerAllConnectors({ manager, vault: makeMockVault() });

    const uiConnectors = manager.registered.filter((c) => c.tier === 'UI');
    expect(uiConnectors).toHaveLength(0);
  });

  it('registers both API and UI connectors when browser is provided', () => {
    const manager = makeMockManager();
    const mockBrowser = {} as never; // Playwright Browser mock

    registerAllConnectors({
      manager,
      vault: makeMockVault(),
      browser: mockBrowser,
    });

    const apiConnectors = manager.registered.filter((c) => c.tier === 'API');
    const uiConnectors = manager.registered.filter((c) => c.tier === 'UI');

    expect(apiConnectors).toHaveLength(4);
    expect(uiConnectors).toHaveLength(4);

    const uiPlatforms = uiConnectors.map((c) => c.platformId);
    expect(uiPlatforms).toContain('ROBINHOOD');
    expect(uiPlatforms).toContain('COINBASE');
    expect(uiPlatforms).toContain('INTERACTIVE_BROKERS');
    expect(uiPlatforms).toContain('FIDELITY');
  });

  it('total registered connectors is 8 with browser', () => {
    const manager = makeMockManager();
    registerAllConnectors({
      manager,
      vault: makeMockVault(),
      browser: {} as never,
    });

    expect(manager.registered).toHaveLength(8);
  });
});
