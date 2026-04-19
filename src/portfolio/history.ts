import type { TickerPriceHistory } from '@yojinhq/jintel-client';

import type { PortfolioHistoryPoint, Position } from '../api/graphql/types.js';

/**
 * Decide the earliest day a position contributes to historical totals.
 *
 * Returns a YYYY-MM-DD gate, or `null` meaning "include throughout the window".
 *
 * Rule 1: explicit `entryDate` strictly in the past wins (user declared purchase date).
 * Rule 2: symbol first appears in snapshots after the overall first snapshot → new addition, gate at first-seen.
 * Rule 3: otherwise (first-ever import, or symbol held since the first snapshot) → include throughout.
 *
 * `entryDate === today` is ignored (rule 1 skipped) because the add-position mutation used to default
 * entryDate to today; honoring it would hide the position from all historical points and cause a false
 * jump between yesterday and today's live point.
 */
export function resolvePositionStart(
  pos: Position,
  firstSeenBySymbol: Map<string, string>,
  overallFirstDate: string | null,
  today: string,
): string | null {
  if (pos.entryDate && pos.entryDate < today) {
    return pos.entryDate;
  }
  const firstSeen = firstSeenBySymbol.get(pos.symbol.toUpperCase());
  if (firstSeen && overallFirstDate && firstSeen > overallFirstDate) {
    return firstSeen;
  }
  return null;
}

/** Map Jintel price history to symbol → date → close price. */
export function buildPriceMap(data: TickerPriceHistory[]): Map<string, Map<string, number>> {
  const map = new Map<string, Map<string, number>>();
  for (const ticker of data) {
    const dateMap = new Map<string, number>();
    for (const point of ticker.history) {
      const day = point.date.slice(0, 10);
      dateMap.set(day, point.close);
    }
    map.set(ticker.ticker, dateMap);
  }
  return map;
}

function dateRange(start: string, end: string): string[] {
  const days: string[] = [];
  const d = new Date(start + 'T00:00:00Z');
  const endMs = new Date(end + 'T00:00:00Z').getTime();
  while (d.getTime() <= endMs) {
    days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

function latestBefore(map: Map<string, number>, cutoff: string): number | undefined {
  let latestDay = '';
  let value: number | undefined;
  for (const [day, price] of map) {
    if (day < cutoff && day > latestDay) {
      latestDay = day;
      value = price;
    }
  }
  return value;
}

export function fillCalendarDays(
  priceMap: Map<string, Map<string, number>>,
  start: string,
  end: string,
): Map<string, Map<string, number>> {
  const days = dateRange(start, end);
  const filled = new Map<string, Map<string, number>>();

  for (const [symbol, dateClose] of priceMap) {
    const filledDates = new Map<string, number>();
    let lastClose = latestBefore(dateClose, start);

    for (const day of days) {
      const price = dateClose.get(day);
      if (price != null) lastClose = price;
      if (lastClose != null) filledDates.set(day, lastClose);
    }

    filled.set(symbol, filledDates);
  }

  return filled;
}

export function buildHistoryPoints(
  positions: Position[],
  filledPrices: Map<string, Map<string, number>>,
  start: string,
  end: string,
  gates?: Map<string, string>,
): PortfolioHistoryPoint[] {
  const days = dateRange(start, end);
  const points: PortfolioHistoryPoint[] = [];
  let prevValue = 0;
  let prevCost = 0;

  for (const day of days) {
    let totalValue = 0;
    let totalCost = 0;

    for (const pos of positions) {
      const gate = gates?.get(pos.symbol);
      if (gate && day < gate) continue;
      const close = filledPrices.get(pos.symbol)?.get(day) ?? pos.currentPrice;
      totalValue += pos.quantity * close;
      totalCost += pos.costBasis * pos.quantity;
    }

    const totalPnl = totalValue - totalCost;
    const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

    let periodPnl = 0;
    let periodPnlPercent = 0;
    if (points.length > 0) {
      const valueChange = totalValue - prevValue;
      const costChange = totalCost - prevCost;
      periodPnl = valueChange - costChange;
      periodPnlPercent = prevValue > 0 ? (periodPnl / prevValue) * 100 : 0;
    }

    points.push({
      timestamp: `${day}T16:00:00Z`,
      totalValue,
      totalCost,
      totalPnl,
      totalPnlPercent,
      periodPnl,
      periodPnlPercent,
    });

    prevValue = totalValue;
    prevCost = totalCost;
  }

  return points;
}
