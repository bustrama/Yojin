/**
 * Structured data schemas for display tool cards.
 *
 * Each schema mirrors the data that the web card components render.
 * Non-web channels use these schemas to format rich output natively
 * (Slack Block Kit, Telegram HTML, etc.).
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Portfolio Overview
// ---------------------------------------------------------------------------

export const PortfolioOverviewDataSchema = z.object({
  period: z.enum(['today', 'week', 'ytd']),
  totalValue: z.number(),
  totalPnl: z.number(),
  totalPnlPercent: z.number(),
  positionCount: z.number(),
  topHoldings: z.array(
    z.object({
      symbol: z.string(),
      name: z.string(),
      marketValue: z.number(),
      pnlPercent: z.number(),
    }),
  ),
});

export type PortfolioOverviewData = z.infer<typeof PortfolioOverviewDataSchema>;

// ---------------------------------------------------------------------------
// Positions List
// ---------------------------------------------------------------------------

export const PositionsListDataSchema = z.object({
  variant: z.enum(['top', 'worst', 'movers', 'all']),
  positions: z.array(
    z.object({
      symbol: z.string(),
      name: z.string(),
      marketValue: z.number(),
      pnlPercent: z.number(),
      pnl: z.number(),
    }),
  ),
  totalValue: z.number(),
});

export type PositionsListData = z.infer<typeof PositionsListDataSchema>;

// ---------------------------------------------------------------------------
// Allocation
// ---------------------------------------------------------------------------

export const AllocationDataSchema = z.object({
  totalValue: z.number(),
  byAssetClass: z.array(z.object({ label: z.string(), value: z.number(), weight: z.number() })),
  bySector: z.array(z.object({ label: z.string(), value: z.number(), weight: z.number() })),
  topConcentrations: z.array(z.object({ symbol: z.string(), weight: z.number() })),
});

export type AllocationData = z.infer<typeof AllocationDataSchema>;

// ---------------------------------------------------------------------------
// Morning Briefing
// ---------------------------------------------------------------------------

export const MorningBriefingDataSchema = z.object({
  date: z.string(),
  totalValue: z.number(),
  totalPnl: z.number(),
  totalPnlPercent: z.number(),
  positionCount: z.number(),
  alertCount: z.number(),
  movers: z.array(
    z.object({
      symbol: z.string(),
      name: z.string(),
      pnlPercent: z.number(),
    }),
  ),
  headlines: z.array(z.object({ title: z.string(), source: z.string() })),
});

export type MorningBriefingData = z.infer<typeof MorningBriefingDataSchema>;

// ---------------------------------------------------------------------------
// Discriminated union
// ---------------------------------------------------------------------------

export type DisplayCardData =
  | { type: 'portfolio-overview'; data: PortfolioOverviewData }
  | { type: 'positions-list'; data: PositionsListData }
  | { type: 'allocation'; data: AllocationData }
  | { type: 'morning-briefing'; data: MorningBriefingData };
