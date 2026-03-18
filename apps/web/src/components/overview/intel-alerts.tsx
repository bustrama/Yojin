import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { BadgeVariant } from '../common/badge';
import Button from '../common/button';
import FeedDetailModal from './feed-detail-modal';
import type { FeedDetailData } from './feed-detail-modal';
import { cn } from '../../lib/utils';

type AlertType = 'action' | 'alert' | 'insight';

interface AlertDetail {
  keyPoints: string[];
  analysis: string;
  recommendation?: string;
  relatedTickers?: string[];
  confidence?: number;
}

interface Alert {
  type: AlertType;
  label: string;
  source: string;
  time: string;
  title: string;
  description: string;
  urgency: 'high' | 'medium' | 'low';
  preview: string;
  detail: AlertDetail;
}

/* ── Type config ─────────────────────────────────────────────────── */

const typeConfig: Record<AlertType, { variant: BadgeVariant; color: string; iconBg: string; sectionLabel: string }> = {
  action: { variant: 'accent', color: 'text-accent-primary', iconBg: 'bg-accent-primary/10', sectionLabel: 'Actions' },
  alert: { variant: 'warning', color: 'text-warning', iconBg: 'bg-warning/10', sectionLabel: 'Alerts' },
  insight: { variant: 'success', color: 'text-success', iconBg: 'bg-success/10', sectionLabel: 'Insights' },
};

/* ── Type icons (24×24 viewBox, Heroicons outline) ───────────────── */

function ActionIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"
      />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
      />
    </svg>
  );
}

function InsightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
      />
    </svg>
  );
}

const typeIcon: Record<AlertType, React.FC<{ className?: string }>> = {
  action: ActionIcon,
  alert: AlertIcon,
  insight: InsightIcon,
};

/* ── Mock data ───────────────────────────────────────────────────── */

const alerts: Alert[] = [
  {
    type: 'action',
    label: 'Action',
    source: 'Risk Manager',
    time: 'Now',
    title: 'Rebalance Portfolio',
    description: 'Tech allocation exceeds 45% target. Consider trimming NVDA position.',
    urgency: 'high',
    preview:
      'Your tech allocation has reached 47.3%, exceeding the 45% target. NVDA alone represents 18.2% of the portfolio, breaching the 15% single-stock guideline.',
    detail: {
      keyPoints: [
        'Technology sector weight: 47.3% (target: 45%, hard limit: 50%) — breached soft limit',
        'Single-stock concentration: NVDA at 18.2% exceeds the 15% guideline',
        'Portfolio beta to QQQ has risen to 1.24, indicating elevated tech sensitivity',
      ],
      analysis:
        "The portfolio's tech overweight has developed gradually as NVDA and other semiconductor names outperformed. While the positions have been profitable, the concentration creates asymmetric downside risk — a 10% tech correction would impact the portfolio 1.24x. Historical analysis shows that portfolios with sector weights above 45% experience 30% higher drawdowns during sector-specific selloffs. The current market environment of sector rotation makes this rebalancing particularly timely.",
      recommendation:
        'Consider trimming NVDA by 50-75 shares ($9,200-$13,800) to bring tech allocation below 42%. Redirect proceeds to underweight sectors: healthcare (current: 8%, target: 12%) and energy (current: 4%, target: 8%). Alternatively, add a QQQ put hedge to reduce effective beta.',
      relatedTickers: ['NVDA', 'AAPL', 'MSFT', 'QQQ'],
      confidence: 87,
    },
  },
  {
    type: 'action',
    label: 'Action',
    source: 'Risk Manager',
    time: '30m',
    title: 'Stop Loss Approaching',
    description: 'META approaching -8% drawdown threshold. Review exit strategy.',
    urgency: 'high',
    preview:
      'META has declined 7.8% from recent peak, approaching your -8% drawdown threshold. Current unrealized P&L: -$2,340. Only $1.08 (0.2%) above trigger level.',
    detail: {
      keyPoints: [
        'META down 7.8% from 52-week high of $542 — your threshold is -8% (triggers at $498.64)',
        'Current price: $499.72 — only $1.08 (0.2%) above trigger level',
        'Volume has been 1.4x average on down days — institutional distribution pattern',
      ],
      analysis:
        "META's decline coincides with broader concerns about Reality Labs spending ($4.5B/quarter) and ad revenue growth deceleration. The stock has broken below its 50-day moving average ($518) and is testing the 100-day MA ($497). Volume patterns suggest institutional selling, which typically persists for 2-3 weeks. Technical support exists at $485 (200-day MA) and $460 (prior consolidation zone). The risk/reward at current levels is unfavorable with a 2:1 downside-to-upside ratio based on technical levels.",
      recommendation:
        'If $498.64 is breached, execute the planned stop: sell 50% of position (approximately $7,500). Hold remaining 50% with a tightened stop at $485 (200-day MA). If the 200-day holds, the risk/reward improves significantly. Consider redeploying proceeds into a high-quality name with better technical setup.',
      relatedTickers: ['META'],
      confidence: 91,
    },
  },
  {
    type: 'alert',
    label: 'Alert',
    source: 'Research Analyst',
    time: '15m',
    title: 'Earnings This Week',
    description: 'AAPL reports earnings Thursday after market close. Current position: 150 shares.',
    urgency: 'medium',
    preview:
      'AAPL reports Q1 earnings Thursday after market close. Consensus expects EPS of $2.11 on revenue of $124.1B. Options imply a ±5.2% post-earnings move.',
    detail: {
      keyPoints: [
        'Street consensus: EPS $2.11 (+6% YoY), Revenue $124.1B (+4.2% YoY)',
        "Options market implies ±5.2% post-earnings move — above AAPL's 4-quarter average of ±3.8%",
        'Your position: 150 shares at $182.40 avg cost — current unrealized gain: $5,610 (+20.4%)',
      ],
      analysis:
        "Apple's earnings this week carry elevated importance due to the AI narrative. Investors will focus on iPhone 16 sell-through rates, Services revenue growth (expected 14% YoY), and any updates on Apple Intelligence adoption metrics. The options-implied move of ±5.2% suggests uncertainty is above average. Key risk: China revenue, which has been declining for 3 consecutive quarters. Watch for commentary on enterprise AI partnerships announced last month.",
      recommendation:
        'Consider protective puts if position sizing exceeds 10% of portfolio (currently 8.3%). A $215 put expiring Friday would cost approximately $3.20/share ($480 total) and cap downside at -1.8% from current levels. Alternatively, take no action if comfortable with the position size.',
      relatedTickers: ['AAPL'],
      confidence: 74,
    },
  },
  {
    type: 'insight',
    label: 'Insight',
    source: 'Strategist',
    time: '1h',
    title: 'Correlation Detected',
    description: 'MSFT and GOOGL showing 0.92 correlation over 30 days.',
    urgency: 'low',
    preview:
      '30-day rolling correlation between MSFT and GOOGL has risen to 0.92, up from 0.67 a month ago. Combined positions represent 14.8% of portfolio — effectively behaving as one position.',
    detail: {
      keyPoints: [
        'MSFT-GOOGL 30-day correlation: 0.92 (up from 0.67 thirty days ago)',
        'Both positions combined represent 14.8% of portfolio — effectively behaving as one position',
        'Historical mean correlation is 0.71 — current level is 1.8 sigma above average',
      ],
      analysis:
        "The spike in MSFT-GOOGL correlation is likely driven by the shared AI narrative — both stocks are moving on the same catalysts (cloud AI revenue, enterprise AI adoption, capex guidance). When correlations spike above 0.85, the diversification benefit of holding both positions drops significantly. Mathematically, at 0.92 correlation, the combined position's risk is 96% of what it would be if they were perfectly correlated — meaning you're getting almost zero diversification benefit. Historical analysis shows such spikes typically mean-revert within 45-60 days.",
      recommendation:
        "Monitor for mean reversion over the next 30 days. If correlation sustains above 0.85, consider reducing one position by 30-50% to restore diversification. GOOGL may be the trim candidate given its higher beta (1.15 vs MSFT's 0.98) and upcoming antitrust ruling risk.",
      relatedTickers: ['MSFT', 'GOOGL'],
      confidence: 68,
    },
  },
];

/* ── Components ──────────────────────────────────────────────────── */

export default function IntelAlerts() {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [modalData, setModalData] = useState<FeedDetailData | null>(null);
  const navigate = useNavigate();

  const toggleExpand = (key: string) => {
    setExpandedKey(expandedKey === key ? null : key);
  };

  const openDetail = (alert: Alert) => {
    const config = typeConfig[alert.type];
    setModalData({
      title: alert.title,
      source: alert.source,
      time: alert.time,
      tag: alert.label,
      tagVariant: config.variant,
      urgency: alert.urgency,
      confidence: alert.detail.confidence,
      keyPoints: alert.detail.keyPoints,
      analysis: alert.detail.analysis,
      recommendation: alert.detail.recommendation,
      relatedTickers: alert.detail.relatedTickers,
    });
  };

  return (
    <>
      <div className="space-y-3.5 p-3">
        {alerts.map((alert) => {
          const config = typeConfig[alert.type];
          const Icon = typeIcon[alert.type];
          const expanded = expandedKey === alert.title;
          return (
            <div
              key={alert.title}
              className={cn(
                'cursor-pointer rounded-xl border border-border bg-bg-tertiary transition-all',
                expanded ? 'ring-1 ring-border-light' : 'hover:bg-bg-tertiary',
              )}
              onClick={() => toggleExpand(alert.title)}
              role="button"
              tabIndex={0}
              aria-expanded={expanded}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleExpand(alert.title);
                }
              }}
            >
              {/* Card header */}
              <div className="flex items-center gap-3 px-2.5 py-2">
                <div className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg', config.iconBg)}>
                  <Icon className={cn('h-4.5 w-4.5', config.color)} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className={cn('text-3xs font-semibold uppercase tracking-[0.1em]', config.color)}>
                    {alert.label}
                  </span>
                  <p className="truncate text-xs font-medium leading-snug text-text-primary">{alert.title}</p>
                </div>
                <span className="flex-shrink-0 text-2xs text-text-muted">{alert.time}</span>
              </div>

              {/* Expandable preview */}
              <div
                className={cn(
                  'grid transition-[grid-template-rows] duration-200 ease-out',
                  expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                )}
              >
                <div className="overflow-hidden">
                  <div className="border-t border-border/30 px-3 pb-3">
                    <p className="mt-2 text-xs leading-relaxed text-text-secondary">{alert.preview}</p>
                    <div className="mt-4 flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetail(alert);
                        }}
                      >
                        View full analysis
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/chat', {
                            state: {
                              preset: `Analyze this ${alert.label.toLowerCase()}: "${alert.title}" — ${alert.description}`,
                            },
                          });
                        }}
                      >
                        Add to Chat
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <FeedDetailModal open={modalData !== null} onClose={() => setModalData(null)} data={modalData} />
    </>
  );
}
