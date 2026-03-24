import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from 'urql';

import { LATEST_INSIGHT_REPORT_QUERY } from '../../api/documents';
import type { LatestInsightReportQueryResult } from '../../api/types';
import { cn, timeAgo } from '../../lib/utils';
import { DashboardCard } from '../common/dashboard-card';
import { SignalChips } from './signal-chips';

const HEALTH_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  STRONG: { bg: 'bg-success/15', text: 'text-success', label: 'Strong' },
  HEALTHY: { bg: 'bg-success/15', text: 'text-success', label: 'Healthy' },
  CAUTIOUS: { bg: 'bg-warning/15', text: 'text-warning', label: 'Cautious' },
  WEAK: { bg: 'bg-error/15', text: 'text-error', label: 'Weak' },
  CRITICAL: { bg: 'bg-error/15', text: 'text-error', label: 'Critical' },
};

const RATING_STYLES: Record<string, string> = {
  STRONG_BUY: 'text-success',
  BUY: 'text-success',
  HOLD: 'text-text-secondary',
  SELL: 'text-error',
  STRONG_SELL: 'text-error',
};

function formatRating(rating: string): string {
  return rating.replace('_', ' ');
}

export default function YojinSnapCard() {
  const [result] = useQuery<LatestInsightReportQueryResult>({ query: LATEST_INSIGHT_REPORT_QUERY });
  const report = result.data?.latestInsightReport;
  const navigate = useNavigate();

  // Build signalId → { title, url } lookup from all position keySignals
  const signalMap = useMemo(() => {
    const map = new Map<string, { title: string; url: string | null }>();
    if (!report) return map;
    for (const pos of report.positions) {
      for (const sig of pos.keySignals ?? []) {
        map.set(sig.signalId, { title: sig.title, url: sig.url });
      }
    }
    return map;
  }, [report]);

  if (!report) {
    return (
      <DashboardCard title="Yojin Snap" variant="feature" className="flex-1">
        <div className="flex flex-1 items-center justify-center px-5 pb-5">
          <p className="max-w-xs text-center text-base leading-relaxed text-text-secondary">
            Run <span className="font-medium text-text-primary">Process Insights</span> to see your portfolio
            intelligence.
          </p>
        </div>
      </DashboardCard>
    );
  }

  const health = HEALTH_STYLES[report.portfolio.overallHealth] ?? HEALTH_STYLES.CAUTIOUS;

  return (
    <DashboardCard
      title="Yojin Snap"
      variant="feature"
      className="flex-1"
      headerAction={<span className="text-xs text-text-muted">{timeAgo(report.createdAt)}</span>}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-5 pb-5">
        {/* Health badge + summary */}
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'mt-0.5 flex-shrink-0 rounded px-2.5 py-1 text-xs font-semibold uppercase tracking-wider',
              health.bg,
              health.text,
            )}
          >
            {health.label}
          </span>
          <p className="text-sm leading-relaxed text-text-secondary">{report.portfolio.summary}</p>
        </div>

        {/* Position ratings */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {report.positions.map((p) => (
            <span key={p.symbol} className="flex items-center gap-1.5 text-sm">
              <span className="font-medium text-text-primary">{p.symbol}</span>
              <span className={cn('text-xs font-semibold', RATING_STYLES[p.rating] ?? 'text-text-muted')}>
                {formatRating(p.rating)}
              </span>
            </span>
          ))}
        </div>

        {/* Top risks */}
        {report.portfolio.topRisks.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-text-muted">Top Risks</span>
            {report.portfolio.topRisks.slice(0, 2).map((r, i) => (
              <div key={i}>
                <p className="text-sm leading-relaxed text-error/80">{r.text}</p>
                <SignalChips signalIds={r.signalIds} signalMap={signalMap} navigate={navigate} />
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardCard>
  );
}
