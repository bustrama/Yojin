/**
 * Platform connector registration barrel.
 *
 * Wires all platform-specific connectors into the ConnectionManager.
 * Called from the composition root (src/main.ts).
 */

import type { Browser } from 'playwright';

import type { SecretVault } from '../../trust/vault/types.js';
import type { ConnectionManager } from '../connection-manager.js';
import { SessionStore } from '../session-store.js';
import { BinanceApiConnector } from './binance/api-connector.js';
import { CoinbaseApiConnector } from './coinbase/api-connector.js';
import { CoinbaseUiConnector } from './coinbase/ui-connector.js';
import { FidelityUiConnector } from './fidelity/ui-connector.js';
import { IbkrApiConnector } from './ibkr/api-connector.js';
import { IbkrUiConnector } from './ibkr/ui-connector.js';
import { PolymarketApiConnector } from './polymarket/api-connector.js';
import { RobinhoodUiConnector } from './robinhood/ui-connector.js';

// ---------------------------------------------------------------------------
// Registration options
// ---------------------------------------------------------------------------

export interface RegisterConnectorsOptions {
  manager: ConnectionManager;
  vault: SecretVault;
  /** Playwright Browser instance — required for UI tier connectors. */
  browser?: Browser;
  /** Path to sessions directory (default: data/cache/sessions). */
  sessionsDir?: string;
  /** Path to cache directory for screenshots (default: data/cache). */
  cacheDir?: string;
}

// ---------------------------------------------------------------------------
// Register all connectors
// ---------------------------------------------------------------------------

/**
 * Register all platform connectors with the ConnectionManager.
 *
 * API tier connectors are always registered.
 * UI tier connectors are only registered when a Playwright Browser is provided.
 */
export function registerAllConnectors(opts: RegisterConnectorsOptions): void {
  const { manager, vault, browser } = opts;
  const sessionsDir = opts.sessionsDir ?? 'data/cache/sessions';
  const cacheDir = opts.cacheDir ?? 'data/cache';

  // -------------------------------------------------------------------------
  // API tier — always available
  // -------------------------------------------------------------------------

  manager.registerConnector(new CoinbaseApiConnector(vault));
  manager.registerConnector(new BinanceApiConnector(vault));
  manager.registerConnector(new IbkrApiConnector(vault));
  manager.registerConnector(new PolymarketApiConnector(vault));

  // -------------------------------------------------------------------------
  // UI tier — requires Playwright Browser
  // -------------------------------------------------------------------------

  if (browser) {
    const sessionStore = new SessionStore({ vault, sessionsDir });

    manager.registerConnector(new RobinhoodUiConnector(vault, browser, sessionStore, cacheDir));
    manager.registerConnector(new CoinbaseUiConnector(vault, browser, sessionStore, cacheDir));
    manager.registerConnector(new IbkrUiConnector(vault, browser, sessionStore, cacheDir));
    manager.registerConnector(new FidelityUiConnector(vault, browser, sessionStore, cacheDir));
  }
}

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------

export { BinanceApiConnector } from './binance/api-connector.js';
export { CoinbaseApiConnector } from './coinbase/api-connector.js';
export { CoinbaseUiConnector } from './coinbase/ui-connector.js';
export { FidelityUiConnector } from './fidelity/ui-connector.js';
export { IbkrApiConnector } from './ibkr/api-connector.js';
export { IbkrUiConnector } from './ibkr/ui-connector.js';
export { PolymarketApiConnector } from './polymarket/api-connector.js';
export { RobinhoodUiConnector } from './robinhood/ui-connector.js';
