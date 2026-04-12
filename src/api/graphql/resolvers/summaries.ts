/**
 * Summary resolvers — query neutral intel observations from macro + micro
 * insight pipelines. Summaries are read-only: no mutations, no approval
 * lifecycle. Action-style mutations live in resolvers/actions.ts.
 *
 * Module-level state: setSummaryStore and setSummarySignalArchive are called
 * once during server startup.
 */

import type { SignalArchive } from '../../../signals/archive.js';
import type { SignalType } from '../../../signals/types.js';
import type { SummaryStore } from '../../../summaries/summary-store.js';
import type { Summary, SummaryFlow } from '../../../summaries/types.js';

function deriveSeverityLabel(severity: number | undefined): string {
  if (severity == null) return 'MEDIUM';
  if (severity >= 0.7) return 'CRITICAL';
  if (severity >= 0.4) return 'HIGH';
  return 'MEDIUM';
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let store: SummaryStore | null = null;
let signalArchive: SignalArchive | null = null;

export function setSummaryStore(s: SummaryStore): void {
  store = s;
}

export function setSummarySignalArchive(a: SignalArchive): void {
  signalArchive = a;
}

// ---------------------------------------------------------------------------
// GraphQL shapes
// ---------------------------------------------------------------------------

interface SummarySourceSignalGql {
  id: string;
  type: SignalType;
  title: string;
  link: string | null;
  sourceName: string | null;
}

interface SummaryGql {
  id: string;
  ticker: string;
  what: string;
  flow: SummaryFlow;
  severity: number | null;
  severityLabel: string;
  sourceSignalIds: string[];
  contentHash: string;
  createdAt: string;
}

function toGql(summary: Summary): SummaryGql {
  return {
    id: summary.id,
    ticker: summary.ticker,
    what: summary.what,
    flow: summary.flow,
    severity: summary.severity ?? null,
    severityLabel: deriveSeverityLabel(summary.severity),
    sourceSignalIds: summary.sourceSignalIds ?? [],
    contentHash: summary.contentHash,
    createdAt: summary.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Field resolvers
// ---------------------------------------------------------------------------

async function resolveSourceSignals(parent: SummaryGql): Promise<SummarySourceSignalGql[]> {
  if (!signalArchive || parent.sourceSignalIds.length === 0) return [];

  const signals = await signalArchive.getByIds(parent.sourceSignalIds);
  return signals.map((s) => ({
    id: s.id,
    type: s.type,
    title: s.title,
    link: typeof s.metadata?.link === 'string' ? s.metadata.link : null,
    sourceName: s.sources[0]?.name ?? null,
  }));
}

export const summaryFieldResolvers = {
  sourceSignals: resolveSourceSignals,
};

// ---------------------------------------------------------------------------
// Query resolvers
// ---------------------------------------------------------------------------

export async function summariesResolver(
  _parent: unknown,
  args: { ticker?: string; flow?: SummaryFlow; since?: string; limit?: number },
): Promise<SummaryGql[]> {
  if (!store) return [];

  const summaries = await store.query({
    ticker: args.ticker,
    flow: args.flow,
    since: args.since,
    limit: args.limit ?? 50,
  });

  return summaries.map(toGql);
}

export async function summaryResolver(_parent: unknown, args: { id: string }): Promise<SummaryGql | null> {
  if (!store) return null;

  const summary = await store.getById(args.id);
  return summary ? toGql(summary) : null;
}
