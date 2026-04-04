import { useEffect } from 'react';
import { useQuery } from 'urql';

import { MARKET_STATUS_QUERY } from '../api/documents';
import type { MarketSession, MarketStatusQueryResult } from '../api/types';

export type MarketStatus = 'open' | 'pre-market' | 'after-hours' | 'closed';

interface MarketState {
  status: MarketStatus;
  label: string;
}

const MARKET_OPEN_MINUTE = 570; // 9:30 AM ET
const MARKET_DURATION = 390; // 6.5 hours in minutes

/** Returns minutes elapsed since market open (0–390). Only meaningful when status is 'open'. */
export function getMarketElapsedMinutes(): number {
  const now = new Date();
  const et = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});

  const time = parseInt(et.hour, 10) * 60 + parseInt(et.minute, 10);
  return Math.max(0, Math.min(time - MARKET_OPEN_MINUTE, MARKET_DURATION));
}

function sessionToState(session: MarketSession, isTradingDay: boolean): MarketState {
  if (!isTradingDay || session === 'CLOSED') return { status: 'closed', label: 'Closed' };
  if (session === 'PRE_MARKET') return { status: 'pre-market', label: 'Pre-Market' };
  if (session === 'OPEN') return { status: 'open', label: 'Market Open' };
  return { status: 'after-hours', label: 'After Hours' };
}

/**
 * Returns current US equity market status, NYSE holiday-aware.
 * Queries Jintel via Yojin's backend; re-polls every minute.
 */
export function useMarketStatus(): MarketState {
  const [result, executeQuery] = useQuery<MarketStatusQueryResult>({
    query: MARKET_STATUS_QUERY,
  });

  // Re-poll every minute so session transitions are reflected promptly
  useEffect(() => {
    const id = setInterval(() => executeQuery({ requestPolicy: 'network-only' }), 60_000);
    return () => clearInterval(id);
  }, [executeQuery]);

  if (result.data) {
    const { session, isTradingDay } = result.data.marketStatus;
    return sessionToState(session, isTradingDay);
  }

  // While loading or on error, fall back to local time-based computation (no holiday awareness)
  return computeLocal();
}

function computeLocal(): MarketState {
  const now = new Date();
  const et = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hour12: false,
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});

  const day = et.weekday;
  const hour = parseInt(et.hour, 10);
  const minute = parseInt(et.minute, 10);
  const time = hour * 60 + minute;

  if (day === 'Sat' || day === 'Sun') return { status: 'closed', label: 'Closed' };
  if (time >= 240 && time < 570) return { status: 'pre-market', label: 'Pre-Market' };
  if (time >= 570 && time < 960) return { status: 'open', label: 'Market Open' };
  if (time >= 960 && time < 1200) return { status: 'after-hours', label: 'After Hours' };
  return { status: 'closed', label: 'Closed' };
}
