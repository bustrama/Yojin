/**
 * ProcessInsights workflow — multi-agent pipeline that analyzes the full
 * portfolio against recent signals and produces structured InsightReports.
 *
 * Stages:
 *   0. Research Analyst (serial)  — gathers data + deep analysis per position
 *   1. Risk Manager (serial)     — portfolio risk from research brief
 *   2. Strategist (serial)       — synthesis, saves InsightReport, updates brain
 */

import type { InsightStore } from './insight-store.js';
import type { Orchestrator } from '../agents/orchestrator.js';
import { createSubsystemLogger } from '../logging/logger.js';

const logger = createSubsystemLogger('process-insights');

export interface ProcessInsightsOptions {
  insightStore: InsightStore;
}

export function registerProcessInsightsWorkflow(orchestrator: Orchestrator, _options: ProcessInsightsOptions): void {
  orchestrator.register({
    id: 'process-insights',
    name: 'Process Insights',
    stages: [
      // Stage 0: Research Analyst — data gathering + deep analysis (merged)
      {
        agentId: 'research-analyst',
        buildMessage: () =>
          `Analyze all positions in the current portfolio.\n\n` +
          `## API Budget — minimize external calls\n` +
          `You MUST minimize tool calls. Use batch parameters wherever possible.\n\n` +
          `1. Call get_portfolio ONCE to see all current holdings\n` +
          `2. Call market_quotes ONCE with ALL tickers in a single batch\n` +
          `3. Call grep_signals ONCE with tickers=[...all tickers...] and since=(7 days ago) — ` +
          `   this accepts an array and returns results grouped by ticker\n` +
          `4. Call recall_signal_memories ONCE with tickers=[...all tickers...] — ` +
          `   this accepts an array and searches across all at once\n` +
          `5. Call batch_enrich ONCE with all tickers that have signal activity,\n` +
          `   using fields: ['market', 'risk']. Max 20 tickers per call.\n\n` +
          `CRITICAL: Do NOT loop over tickers calling grep_signals or recall_signal_memories individually.\n` +
          `Both tools accept a tickers array — use it to get all data in ONE call each.\n\n` +
          `## Output — structured research brief per position\n` +
          `For each position produce:\n` +
          `- Symbol, name, key data points (price, market cap, P/E, etc.)\n` +
          `- Recent signals summary with sentiment direction\n` +
          `- Deep analysis: conflicting signals, sentiment shifts, upcoming catalysts, technical pattern changes\n` +
          `- Notable changes or anomalies\n\n` +
          `IMPORTANT: For each signal, preserve its exact ID (e.g. sig-xxx) and source link URL. ` +
          `These will be used for provenance tracking in the final report.`,
      },

      // Stage 1: Risk Manager — portfolio risk from research brief
      {
        agentId: 'risk-manager',
        buildMessage: (prev) =>
          `Analyze full portfolio risk based on these positions.\n` +
          `Compute: sector exposure breakdown, concentration scoring, ` +
          `correlation detection, and drawdown analysis.\n\n` +
          `DO NOT call enrich_entity, batch_enrich, or market_quotes — all data is in the brief below.\n\n` +
          `Position data:\n${prev.get('research-analyst')?.text ?? ''}`,
      },

      // Stage 2: Strategist synthesizes and persists
      {
        agentId: 'strategist',
        buildMessage: (prev) => {
          const researchOutput = prev.get('research-analyst')?.text ?? '';
          const riskOutput = prev.get('risk-manager')?.text ?? '';

          return (
            `Synthesize insights for the entire portfolio.\n\n` +
            `## Research Analysis\n${researchOutput}\n\n` +
            `## Risk Analysis\n${riskOutput}\n\n` +
            `## Instructions\n` +
            `1. Call recall_signal_memories to review past portfolio-level observations\n` +
            `2. Call brain_get_memory and brain_get_emotion to review your current state\n` +
            `3. For each position, determine: rating (STRONG_BUY/BUY/HOLD/SELL/STRONG_SELL), ` +
            `conviction (0-1), thesis, key signals (include signal ID and source URL in each), risks, and opportunities\n` +
            `4. Determine portfolio-level: overall health (STRONG/HEALTHY/CAUTIOUS/WEAK/CRITICAL), ` +
            `summary, sector themes, macro context, top risks, top opportunities, action items\n` +
            `5. Call save_insight_report with the complete structured report\n` +
            `6. Call brain_update_memory with your key findings\n` +
            `7. Call brain_update_emotion with your updated confidence and risk appetite\n` +
            `8. Call store_signal_memory for any significant new observations`
          );
        },
      },
    ],
  });

  logger.info('ProcessInsights workflow registered');
}
