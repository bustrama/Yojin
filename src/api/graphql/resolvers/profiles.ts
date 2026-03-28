import type { TickerProfileStore } from '../../../profiles/profile-store.js';

let store: TickerProfileStore | null = null;

export function setProfileStore(s: TickerProfileStore): void {
  store = s;
}

function buildProfileResponse(ticker: string) {
  if (!store) return null;
  const entries = store.getForTicker(ticker);
  const brief = store.buildBrief(ticker);
  return {
    ticker,
    entryCount: entries.length,
    entries,
    brief,
  };
}

export function tickerProfileQuery(_: unknown, args: { ticker: string }) {
  return buildProfileResponse(args.ticker);
}

export function tickerProfilesQuery(_: unknown, args: { tickers: string[] }) {
  if (!store) return [];
  return args.tickers
    .map((ticker) => buildProfileResponse(ticker))
    .filter((p): p is NonNullable<typeof p> => p !== null && p.entryCount > 0);
}
