/**
 * Profile Bridge — extracts per-asset knowledge from InsightReports.
 *
 * After each insight run, this module deterministically extracts structured
 * observations from the InsightReport and stores them as TickerProfileEntries.
 * No LLM is needed — the LLM already did the analysis; we just structure it.
 *
 * Entry categories extracted:
 *   PATTERN          — from keySignals (signal type + impact)
 *   SENTIMENT_SHIFT  — when rating changed vs previous report
 *   CORRELATION      — when a thesis mentions another portfolio ticker
 *   CONTEXT          — sector themes relevant to specific positions
 */

import type { TickerProfileEntry } from './types.js';
import type { InsightReport, PositionInsight } from '../insights/types.js';
import type { Grade } from '../memory/types.js';

type EntryInput = Omit<TickerProfileEntry, 'id' | 'createdAt'>;

/**
 * Extract profile entries from a completed InsightReport.
 * Skips carried-forward positions (already profiled in a prior run).
 */
export function extractProfileEntries(report: InsightReport, previousReport: InsightReport | null): EntryInput[] {
  const entries: EntryInput[] = [];
  const allSymbols = new Set(report.positions.map((p) => p.symbol));

  // Index previous report by symbol for sentiment shift detection
  const prevBySymbol = new Map<string, PositionInsight>();
  if (previousReport) {
    for (const pos of previousReport.positions) {
      prevBySymbol.set(pos.symbol, pos);
    }
  }

  for (const position of report.positions) {
    if (position.carriedForward) continue;

    const base = {
      ticker: position.symbol,
      insightReportId: report.id,
      insightDate: report.createdAt,
      rating: position.rating,
      conviction: position.conviction,
      priceAtObservation: position.priceTarget,
      grade: null,
      actualReturn: null,
    } as const;

    // PATTERN entries — from key signals
    for (const signal of position.keySignals) {
      entries.push({
        ...base,
        category: 'PATTERN',
        observation: `${signal.type}: ${signal.title} (${signal.impact})`,
        evidence: `Signal ${signal.signalId}, confidence ${signal.confidence.toFixed(2)}, ${signal.sourceCount} source(s)`,
      });
    }

    // SENTIMENT_SHIFT — detect rating change from previous report
    const prev = prevBySymbol.get(position.symbol);
    if (prev && prev.rating !== position.rating) {
      entries.push({
        ...base,
        category: 'SENTIMENT_SHIFT',
        observation: `Shifted from ${prev.rating} to ${position.rating}`,
        evidence: `Previous: ${prev.thesis.slice(0, 120)}. Current: ${position.thesis.slice(0, 120)}`,
      });
    }

    // CORRELATION — detect mentions of other portfolio tickers in thesis
    for (const otherSymbol of allSymbols) {
      if (otherSymbol === position.symbol) continue;
      // Use word boundary matching to avoid false positives with short tickers
      const escaped = otherSymbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`(?<![A-Z0-9])${escaped}(?![A-Z0-9])`, 'i');
      if (pattern.test(position.thesis)) {
        entries.push({
          ...base,
          category: 'CORRELATION',
          observation: `Correlated with ${otherSymbol}`,
          evidence: position.thesis.slice(0, 200),
        });
      }
    }
  }

  // CONTEXT entries — from portfolio-level sector themes
  if (report.portfolio.sectorThemes.length > 0) {
    for (const theme of report.portfolio.sectorThemes.slice(0, 3)) {
      // Attribute context to positions whose sector/name appears in the theme
      for (const position of report.positions) {
        if (position.carriedForward) continue;
        const nameWords = position.name.toLowerCase().split(/\s+/);
        const themeWords = theme.toLowerCase();
        if (nameWords.some((w) => w.length > 3 && themeWords.includes(w))) {
          entries.push({
            ticker: position.symbol,
            category: 'CONTEXT',
            observation: theme,
            evidence: `Sector theme from portfolio analysis on ${report.createdAt.slice(0, 10)}`,
            insightReportId: report.id,
            insightDate: report.createdAt,
            rating: position.rating,
            conviction: position.conviction,
            priceAtObservation: position.priceTarget,
            grade: null,
            actualReturn: null,
          });
        }
      }
    }
  }

  return entries;
}

/**
 * Build a LESSON profile entry from a reflected memory entry.
 * Called after the ReflectionEngine grades a prediction.
 */
export function buildLessonEntry(
  ticker: string,
  lesson: string,
  grade: Grade,
  actualReturn: number,
  insightReportId: string,
  insightDate: string,
): EntryInput {
  return {
    ticker,
    category: 'LESSON',
    observation: lesson,
    evidence: `Grade: ${grade}, actual return: ${actualReturn > 0 ? '+' : ''}${actualReturn.toFixed(1)}%`,
    insightReportId,
    insightDate,
    rating: null,
    conviction: null,
    priceAtObservation: null,
    grade,
    actualReturn,
  };
}
