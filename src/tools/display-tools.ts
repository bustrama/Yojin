/**
 * Display tools — UI visualization tools that trigger rich card rendering
 * on the frontend. When the AI calls a `display_*` tool, the chat resolver
 * emits a TOOL_CARD event that the frontend renders via ToolRenderer.
 *
 * These tools don't fetch data — the card components fetch their own data
 * client-side via GraphQL. The tool result provides text context for the AI.
 */

import { z } from 'zod';

import type { ToolDefinition } from '../core/types.js';

export function createDisplayTools(): ToolDefinition[] {
  const displayPortfolioOverview: ToolDefinition = {
    name: 'display_portfolio_overview',
    description:
      'Display a visual portfolio overview card to the user. Shows total value, P&L, return percentage, and largest holdings. Call this when the user asks to see their portfolio performance or overview.',
    parameters: z.object({
      period: z
        .enum(['today', 'week', 'ytd'])
        .describe('Time period for the overview: today, this week, or year-to-date'),
    }),
    async execute(params: { period: string }): Promise<{ content: string }> {
      return {
        content: `Displaying portfolio overview card for period: ${params.period}. The user will see a visual card with their portfolio performance, total value, P&L, and largest holdings.`,
      };
    },
  };

  const displayPositionsList: ToolDefinition = {
    name: 'display_positions_list',
    description:
      'Display a visual positions list card to the user. Shows a filtered and sorted list of portfolio positions. Call this when the user asks to see their positions, top performers, worst performers, or biggest movers.',
    parameters: z.object({
      variant: z
        .enum(['top', 'worst', 'movers', 'all'])
        .describe('Which positions to show: top performers, worst performers, biggest movers, or all positions'),
    }),
    async execute(params: { variant: string }): Promise<{ content: string }> {
      return {
        content: `Displaying positions list card with variant: ${params.variant}. The user will see a visual card with their ${params.variant === 'all' ? 'complete position list' : `${params.variant} performing positions`}.`,
      };
    },
  };

  const displayAllocation: ToolDefinition = {
    name: 'display_allocation',
    description:
      'Display a visual portfolio allocation card to the user. Shows allocation breakdown by asset class and sector with progress bars. Call this when the user asks about their portfolio allocation, diversification, or sector breakdown.',
    parameters: z.object({}),
    async execute(): Promise<{ content: string }> {
      return {
        content:
          'Displaying portfolio allocation card. The user will see a visual card with their allocation breakdown by asset class and sector.',
      };
    },
  };

  const displayMorningBriefing: ToolDefinition = {
    name: 'display_morning_briefing',
    description:
      'Display a visual morning briefing card to the user. Shows a daily summary with portfolio stats, active alerts, recent news headlines, and suggested actions. ALWAYS call this when the user asks for their morning briefing, daily summary, or daily digest.',
    parameters: z.object({}),
    async execute(): Promise<{ content: string }> {
      return {
        content:
          'Displaying morning briefing card. The user will see a visual card with their daily portfolio summary, alerts, and news headlines. Keep any additional commentary brief — the card contains the key data.',
      };
    },
  };

  return [displayPortfolioOverview, displayPositionsList, displayAllocation, displayMorningBriefing];
}
