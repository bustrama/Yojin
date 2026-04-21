/**
 * Supply-chain resolvers — `supplyChainMap(ticker)` and
 * `supplyChainMapsByTickers(tickers)`.
 *
 * Phase A: reads from `SupplyChainStore`. No LLM synthesis, no Jintel call
 * on query. The map is built asynchronously by a future micro-runner stage
 * (Phase C); queries simply return whatever is currently on disk.
 */

import type { SupplyChainStore } from '../../../insights/supply-chain-store.js';
import type { SupplyChainMap } from '../../../insights/supply-chain-types.js';

let store: SupplyChainStore | undefined;

export function setSupplyChainStore(s: SupplyChainStore): void {
  store = s;
}

export async function supplyChainMapQuery(_: unknown, args: { ticker: string }): Promise<SupplyChainMap | null> {
  if (!store) return null;
  return store.get(args.ticker);
}

export async function supplyChainMapsByTickersQuery(
  _: unknown,
  args: { tickers: string[] },
): Promise<SupplyChainMap[]> {
  const s = store;
  if (!s) return [];
  const results = await Promise.all(args.tickers.map((t) => s.get(t)));
  return results.filter((m): m is SupplyChainMap => m !== null);
}
