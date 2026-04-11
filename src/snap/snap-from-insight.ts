/**
 * Derive a Snap brief from the latest InsightReport.
 *
 * The snap surfaces the action items from the insight report —
 * concrete next steps the user should consider. When micro insights
 * are available, per-asset snaps are included alongside portfolio-level items.
 */

import { computeSnapContentHash, snapIdFromHash } from './content-hash.js';
import type { Snap } from './types.js';
import { assetSnapsFromMicro } from './types.js';
import type { MicroInsight } from '../insights/micro-types.js';
import type { InsightReport } from '../insights/types.js';

export interface SnapFromInsightOptions {
  /** Latest micro insights per ticker — used to populate assetSnaps. */
  microInsights?: Map<string, MicroInsight>;
}

/** Derive a Snap from an InsightReport + optional micro insights. */
export function snapFromInsight(report: InsightReport, options?: SnapFromInsightOptions): Snap {
  const assetSnaps = options?.microInsights ? assetSnapsFromMicro(options.microInsights.values()) : [];

  const intelSummary = report.portfolio.intelSummary ?? '';
  const actionItems = report.portfolio.actionItems.map((item) => ({
    text: item.text,
    signalIds: item.signalIds,
  }));
  const contentHash = computeSnapContentHash({ intelSummary, actionItems });

  return {
    id: snapIdFromHash(contentHash),
    generatedAt: new Date().toISOString(),
    intelSummary,
    actionItems,
    assetSnaps,
    contentHash,
  };
}
