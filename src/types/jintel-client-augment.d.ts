/**
 * Extends @yojinhq/jintel-client with the response-cache API added in v0.12.0.
 * Remove this file once jintel-client@0.12.0 is published to npm and Yojin's
 * package.json is updated to that version.
 *
 * The empty import makes this a module file so TypeScript treats the
 * `declare module` block as augmentation, not a replacement.
 */

import type {} from '@yojinhq/jintel-client';

declare module '@yojinhq/jintel-client' {
  interface JintelClientCacheConfig {
    /** TTL for quotes() responses in milliseconds. Default: 30_000 (30s). */
    quotesTtlMs?: number;
    /** TTL for batchEnrich() responses in milliseconds. Default: 300_000 (5 min). */
    enrichTtlMs?: number;
    /** TTL for priceHistory() responses in milliseconds. Default: 300_000 (5 min). */
    priceHistoryTtlMs?: number;
  }

  interface JintelClientConfig {
    cache?: boolean | JintelClientCacheConfig;
  }

  interface JintelClient {
    /**
     * Invalidate all cached responses containing any of the given tickers.
     * No-op when `cache` was not enabled at construction time.
     * Added in v0.12.0 — runtime-guard with `?.invalidateCache?.()` when
     * running against older installed versions.
     */
    invalidateCache(tickers: string[]): void;
  }
}
