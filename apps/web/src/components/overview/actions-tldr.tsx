/**
 * ActionsTldr — severity-ranked TLDR of pending Actions.
 *
 * Reads from the `actions` GraphQL query (populated by the micro-runner's
 * severity gate), sorts by severity DESC, and renders the top N as a compact
 * feed. Each row has approve/reject buttons that call the ActionStore
 * mutations — on success graphcache invalidates the list so the next poll
 * shows the superseded state without a manual refresh.
 *
 * Polls every 30s to match IntelFeed's cadence. `cache-and-network` so the
 * UI paints from cache immediately, then reconciles against the server.
 */

import { Check, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useActions, useApproveAction, useRejectAction } from '../../api';
import type { Action } from '../../api/types';
import { cn, timeAgo } from '../../lib/utils';
import Spinner from '../common/spinner';

const POLL_INTERVAL_MS = 30_000;
const DEFAULT_VISIBLE = 5;

interface SeverityBand {
  label: string;
  className: string;
}

/** Map a 0–1 severity score to a visual band (mirrors the analyzer prompt's ladder). */
function severityBand(severity: number | null): SeverityBand {
  if (severity === null) return { label: 'INFO', className: 'bg-bg-tertiary text-text-muted' };
  if (severity >= 0.9) return { label: 'CRITICAL', className: 'bg-error/15 text-error' };
  if (severity >= 0.7) return { label: 'HIGH', className: 'bg-warning/15 text-warning' };
  if (severity >= 0.4) return { label: 'MEDIUM', className: 'bg-info/15 text-info' };
  if (severity >= 0.1) return { label: 'LOW', className: 'bg-accent-primary/10 text-accent-primary' };
  return { label: 'NOISE', className: 'bg-bg-tertiary text-text-muted' };
}

/** Extract ticker from `source: "micro-observation: AAPL"` — the canonical shape from micro-runner. */
function extractTicker(source: string): string | null {
  const match = source.match(/^micro-observation:\s*(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export default function ActionsTldr() {
  const [{ data, fetching, error }, reexecute] = useActions({ status: 'PENDING', limit: 50 });
  const [, approveAction] = useApproveAction();
  const [, rejectAction] = useRejectAction();
  const [showAll, setShowAll] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Poll. Each tick reconciles against the server via cache-and-network.
  useEffect(() => {
    const id = setInterval(() => reexecute({ requestPolicy: 'cache-and-network' }), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [reexecute]);

  // Sort by severity DESC, then createdAt DESC. Null severity sinks to the bottom.
  const sorted: Action[] = useMemo(() => {
    const list = data?.actions ?? [];
    return [...list].sort((a, b) => {
      const sa = a.severity ?? -1;
      const sb = b.severity ?? -1;
      if (sa !== sb) return sb - sa;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [data?.actions]);

  const visible = showAll ? sorted : sorted.slice(0, DEFAULT_VISIBLE);
  const hiddenCount = Math.max(0, sorted.length - DEFAULT_VISIBLE);

  const handleApprove = async (id: string) => {
    setBusyId(id);
    const result = await approveAction({ id });
    setBusyId(null);
    if (result.error) {
      // Approval failed — log and let the user retry. Don't optimistically
      // remove from the list; graphcache invalidation on success handles that.
      console.error('Approve action failed', result.error);
    }
  };

  const handleReject = async (id: string) => {
    setBusyId(id);
    const result = await rejectAction({ id });
    setBusyId(null);
    if (result.error) {
      console.error('Reject action failed', result.error);
    }
  };

  // Loading on first fetch (no cached data yet).
  if (fetching && !data) {
    return (
      <div className="border-b border-border px-4 py-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Actions TLDR</h3>
        </div>
        <div className="flex justify-center">
          <Spinner size="sm" label="Loading actions…" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-b border-border px-4 py-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Actions TLDR</h3>
        <p className="text-sm text-error">Failed to load actions: {error.message}</p>
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="border-b border-border px-4 py-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Actions TLDR</h3>
        <p className="text-sm text-text-muted">No pending observations. New items appear automatically.</p>
      </div>
    );
  }

  return (
    <div className="border-b border-border px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Actions TLDR</h3>
        <span className="text-xs text-text-muted">{sorted.length} pending</span>
      </div>

      <ul className="space-y-2">
        {visible.map((action) => {
          const band = severityBand(action.severity);
          const ticker = extractTicker(action.source);
          const isBusy = busyId === action.id;
          return (
            <li
              key={action.id}
              className={cn(
                'rounded-lg border border-border-light bg-bg-card p-3 transition-colors',
                isBusy && 'opacity-60',
              )}
            >
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    'flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                    band.className,
                  )}
                >
                  {band.label}
                </span>
                {ticker && <span className="flex-shrink-0 text-xs font-semibold text-text-primary">{ticker}</span>}
                <span className="ml-auto flex-shrink-0 text-[10px] text-text-muted">{timeAgo(action.createdAt)}</span>
              </div>
              <p className="mt-1.5 text-sm leading-snug text-text-secondary">{action.what}</p>
              <div className="mt-2 flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => handleReject(action.id)}
                  disabled={isBusy}
                  aria-label="Reject action"
                  className="rounded p-1 text-text-muted transition-colors hover:bg-error/10 hover:text-error disabled:cursor-not-allowed"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleApprove(action.id)}
                  disabled={isBusy}
                  aria-label="Approve action"
                  className="rounded p-1 text-text-muted transition-colors hover:bg-success/10 hover:text-success disabled:cursor-not-allowed"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((prev) => !prev)}
          className="mt-3 w-full rounded-lg border border-border-light py-1.5 text-xs text-text-muted transition-colors hover:bg-bg-hover hover:text-text-secondary"
        >
          {showAll ? 'Show less' : `Show ${hiddenCount} more`}
        </button>
      )}
    </div>
  );
}
