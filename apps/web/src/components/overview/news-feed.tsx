import { useState } from 'react';
import type { BadgeVariant } from '../common/badge';
import FeedDetailModal from './feed-detail-modal';
import type { FeedDetailData } from './feed-detail-modal';
import { cn } from '../../lib/utils';

type NewsCategory = 'Fundamentals' | 'News' | 'Sentiment' | 'Filings' | 'Socials' | 'Macro';

interface FeedItemDetail {
  keyPoints: string[];
  analysis: string;
  relatedTickers?: string[];
  sentiment?: 'bullish' | 'bearish' | 'neutral';
  impact?: 'high' | 'medium' | 'low';
}

export interface FeedItem {
  source: string;
  time: string;
  title: string;
  tag: NewsCategory;
  preview: string;
  detail: FeedItemDetail;
}

/* ── Category config ─────────────────────────────────────────────── */

const categoryConfig: Record<NewsCategory, { variant: BadgeVariant; color: string; iconBg: string }> = {
  Fundamentals: { variant: 'success', color: 'text-success', iconBg: 'bg-success/10' },
  News: { variant: 'info', color: 'text-info', iconBg: 'bg-info/10' },
  Sentiment: { variant: 'market', color: 'text-market', iconBg: 'bg-market/10' },
  Filings: { variant: 'neutral', color: 'text-text-muted', iconBg: 'bg-bg-hover' },
  Socials: { variant: 'accent', color: 'text-accent-primary', iconBg: 'bg-accent-primary/10' },
  Macro: { variant: 'warning', color: 'text-warning', iconBg: 'bg-warning/10' },
};

/* ── Category icons (16×16 viewBox, stroke-based) ────────────────── */

function FundamentalsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" d="M3.5 12V9M8 12V5.5M12.5 12V3" />
      <path strokeLinecap="round" d="M2 13.5h12" />
    </svg>
  );
}

function NewsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3}>
      <rect x="2" y="2.5" width="10" height="11" rx="1" />
      <path d="M12 5.5h1.5a.5.5 0 0 1 .5.5v6a2 2 0 0 1-2 2" />
      <path strokeLinecap="round" d="M4.5 5.5h2.5v2.5H4.5zM9 5.5h1.5M9 7.5h1.5M4.5 10h5" />
    </svg>
  );
}

function SentimentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 8h2.5l1.5-3.5 2 7 1.5-4.5 1 1H13.5" />
    </svg>
  );
}

function FilingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3}>
      <path d="M4.5 2h5l3 3v8.5a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
      <path d="M9.5 2v3h3" />
      <path strokeLinecap="round" d="M6 9h4M6 11.5h2.5" />
    </svg>
  );
}

function SocialsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3}>
      <path d="M2 3.5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1H5.5L3 10V8H3a1 1 0 0 1-1-1V3.5Z" />
      <path d="M6 9v1.5a1 1 0 0 0 1 1h3.5l2 1.5v-1.5h.5a1 1 0 0 0 1-1V7.5a1 1 0 0 0-1-1H11" />
    </svg>
  );
}

function MacroIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3}>
      <circle cx="8" cy="8" r="6" />
      <path d="M2 8h12" />
      <path d="M8 2c-1.8 1.8-2.8 3.8-2.8 6s1 4.2 2.8 6c1.8-1.8 2.8-3.8 2.8-6S9.8 3.8 8 2Z" />
    </svg>
  );
}

const categoryIcon: Record<NewsCategory, React.FC<{ className?: string }>> = {
  Fundamentals: FundamentalsIcon,
  News: NewsIcon,
  Sentiment: SentimentIcon,
  Filings: FilingsIcon,
  Socials: SocialsIcon,
  Macro: MacroIcon,
};

const GROUP_ORDER: NewsCategory[] = ['Macro', 'Fundamentals', 'Sentiment', 'News', 'Filings', 'Socials'];

/* ── Mock data ───────────────────────────────────────────────────── */

const newsItems: FeedItem[] = [
  {
    source: 'Reuters',
    time: '2h',
    title: 'Fed signals potential rate adjustment in upcoming meeting',
    tag: 'Macro',
    preview:
      'Federal Reserve officials indicated growing openness to adjusting interest rates, citing evolving inflation data and labor market conditions that may warrant policy recalibration.',
    detail: {
      keyPoints: [
        'FOMC minutes suggest growing consensus for a pause in rate hikes, with two members favoring a 25bp cut',
        'Core PCE inflation trending toward 2.4% — closer to target but still above the 2% goal',
        'Labor market showing signs of gradual cooling with unemployment ticking up to 3.9%',
      ],
      analysis:
        "The Federal Reserve's latest signals mark a notable shift in tone from recent hawkish positioning. While a rate cut isn't imminent, the language suggests the bar for maintaining current rates is rising. Bond markets have responded with a rally in longer-duration Treasuries, pushing the 10-year yield down 12bps. For equity portfolios, this creates a mixed signal: lower rates support valuations, but the underlying reason — economic softening — may pressure earnings growth in cyclical sectors. The market is currently pricing in a 62% probability of a rate cut by June.",
      relatedTickers: ['SPY', 'TLT', 'GLD', 'DXY'],
      sentiment: 'bearish',
      impact: 'high',
    },
  },
  {
    source: 'Bloomberg',
    time: '3h',
    title: 'NVDA reports record quarterly revenue, beats estimates',
    tag: 'Fundamentals',
    preview:
      'NVIDIA posted $22.1B in quarterly revenue, surpassing analyst estimates by 12%. Data center segment drove 76% of total revenue on unprecedented AI infrastructure demand.',
    detail: {
      keyPoints: [
        'Data center revenue surged 409% YoY to $18.4B, driven by unprecedented AI infrastructure demand',
        'Gross margin expanded to 76.7%, up from 64.6% a year ago — pricing power remains strong',
        'Management guided Q2 revenue of $28B ±2%, well above consensus of $24.6B',
      ],
      analysis:
        "NVIDIA's results confirm its position as the primary beneficiary of the AI infrastructure buildout. The data center segment's explosive growth reflects both hyperscaler capex cycles and enterprise AI adoption. However, the stock's forward P/E of 38x prices in significant continued growth. Key risks include potential demand pull-forward, emerging competition from AMD's MI300X and custom ASICs, and geopolitical restrictions on China sales. The guidance beat suggests the supply-demand imbalance for H100/B100 GPUs persists through at least mid-2025.",
      relatedTickers: ['NVDA', 'AMD', 'AVGO', 'SMH'],
      sentiment: 'bullish',
      impact: 'high',
    },
  },
  {
    source: 'WSJ',
    time: '4h',
    title: 'Tech sector rotation accelerates amid valuation concerns',
    tag: 'Sentiment',
    preview:
      'Institutional investors are reducing technology exposure amid stretched valuations, rotating into energy and healthcare sectors. Large-cap tech funds saw $4.2B in net outflows over two weeks.',
    detail: {
      keyPoints: [
        'Large-cap tech funds saw $4.2B in net outflows over the past two weeks — largest since March 2024',
        'Nasdaq-100 forward P/E has reached 28.5x, 2.1 standard deviations above 10-year average',
        'Energy and healthcare sectors receiving inflows as investors seek relative value',
      ],
      analysis:
        'The rotation out of technology represents a healthy repricing rather than a fundamental deterioration. Fund flow data from EPFR shows institutional investors are not exiting equities but repositioning within them. The trigger appears to be valuation-driven: tech multiples have expanded 40% since October while earnings revisions have been flat. This rotation could persist for 4-8 weeks based on historical patterns, but structural AI tailwinds suggest tech underperformance will be shallow and temporary. Watch the QQQ/SPY ratio for reversal signals.',
      relatedTickers: ['XLK', 'XLE', 'XLV', 'QQQ'],
      sentiment: 'bearish',
      impact: 'medium',
    },
  },
  {
    source: 'SEC EDGAR',
    time: '5h',
    title: 'MSFT files 10-K revealing cloud margin expansion',
    tag: 'Filings',
    preview:
      "Microsoft's annual filing reveals Azure operating margins reached 42%, up from 35% a year ago. Capital expenditure guidance raised to $52B for AI infrastructure build-out.",
    detail: {
      keyPoints: [
        'Azure operating margin reached 42%, expanding 700bps YoY — cloud profitability inflection point',
        'Capital expenditure guided to $52B for FY2025, up 38% YoY — primarily AI datacenter expansion',
        'Segment reporting shows AI revenue run rate exceeded $10B annualized for the first time',
      ],
      analysis:
        "Microsoft's 10-K filing reveals the structural economics of their AI strategy are improving faster than expected. The Azure margin expansion from 35% to 42% demonstrates that AI workloads carry higher margins than traditional cloud compute, likely due to premium pricing and GPU utilization rates above 90%. The $52B capex commitment signals confidence in sustained demand but also raises the stakes — if AI revenue growth decelerates, the return on invested capital could deteriorate. The new segment disclosure around AI revenue ($10B run rate) provides investors with better visibility into the AI contribution.",
      relatedTickers: ['MSFT', 'GOOGL', 'AMZN', 'ORCL'],
      sentiment: 'bullish',
      impact: 'medium',
    },
  },
  {
    source: 'CNBC',
    time: '6h',
    title: 'Apple unveils new AI features for enterprise customers',
    tag: 'News',
    preview:
      'Apple announced enterprise-focused AI capabilities including on-device document analysis and automated workflow tools, partnering with SAP and Salesforce for integration.',
    detail: {
      keyPoints: [
        "New 'Apple Intelligence for Business' suite runs entirely on-device, addressing enterprise data privacy concerns",
        'Partnership with SAP and Salesforce for workflow integration — targets $840B enterprise software market',
        'Analysts estimate potential $8-12B incremental revenue stream by FY2026 from enterprise AI services',
      ],
      analysis:
        "Apple's enterprise AI play leverages its unique advantage: on-device processing with Apple Silicon. While competitors rely on cloud AI, Apple's approach addresses the #1 enterprise concern — data privacy. The SAP/Salesforce partnerships are strategic, embedding Apple Intelligence into existing enterprise workflows. This move could accelerate iPhone and iPad refresh cycles in the enterprise segment (currently ~28% of device revenue). The $8-12B revenue estimate from analysts may be conservative if adoption follows the pattern of enterprise iPad deployments.",
      relatedTickers: ['AAPL', 'MSFT', 'GOOGL', 'CRM'],
      sentiment: 'bullish',
      impact: 'medium',
    },
  },
  {
    source: 'StockTwits',
    time: '7h',
    title: 'TSLA social sentiment surges to 6-month high ahead of robotaxi reveal',
    tag: 'Socials',
    preview:
      'Social media mentions of TSLA jumped 340% this week with 78% bullish sentiment. Retail options activity shows heavy call buying at $280-$300 strikes.',
    detail: {
      keyPoints: [
        'TSLA social mentions jumped 340% week-over-week — highest volume since last earnings',
        'Bullish sentiment ratio at 78%, well above the 60% 90-day average',
        'Retail options activity shows concentrated call buying at $280-$300 strikes for next Friday expiry',
      ],
      analysis:
        'The social sentiment surge around TSLA reflects retail investor anticipation of the upcoming robotaxi event. Historical analysis shows that when TSLA social sentiment exceeds 75% bullish and mention volume spikes above 300%, the stock has moved ±8% in the following week (with a 60% probability of upward movement). However, elevated retail enthusiasm can also indicate crowded positioning — if the robotaxi reveal disappoints, the unwind could be swift. The heavy call buying at $280-$300 creates gamma exposure for dealers that may amplify moves in either direction.',
      relatedTickers: ['TSLA', 'UBER', 'LYFT'],
      sentiment: 'bullish',
      impact: 'medium',
    },
  },
  {
    source: 'FT',
    time: '8h',
    title: 'European markets rally on improved economic outlook',
    tag: 'Macro',
    preview:
      'European equity markets posted broad gains as ECB signaled potential easing and manufacturing PMI data showed unexpected improvement, with Euro Stoxx 50 gaining 2.1%.',
    detail: {
      keyPoints: [
        'Euro Stoxx 50 gained 2.1%, led by German industrials and French luxury goods',
        'Eurozone manufacturing PMI rose to 48.7 from 46.1 — still contracting but improving rapidly',
        'ECB President Lagarde hinted at a June rate cut, the first since 2019',
      ],
      analysis:
        'European equities are benefiting from a confluence of positive catalysts: improving economic data, dovish central bank signals, and attractive valuations relative to US peers. The Euro Stoxx 50 trades at 13.2x forward earnings vs. 21.4x for the S&P 500 — a historically wide discount. The manufacturing PMI improvement suggests the industrial recession may be bottoming. For US-based investors, the EUR/USD move adds a currency tailwind. However, geopolitical risks (Ukraine, trade tensions) remain elevated and could reverse sentiment quickly.',
      relatedTickers: ['EWG', 'FEZ', 'VGK', 'HEDJ'],
      sentiment: 'bullish',
      impact: 'low',
    },
  },
];

/* ── Components ──────────────────────────────────────────────────── */

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={cn('h-3 w-3 text-text-muted transition-transform duration-200', expanded && 'rotate-180')}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5 6 7.5 9 4.5" />
    </svg>
  );
}

export default function NewsFeed() {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [modalData, setModalData] = useState<FeedDetailData | null>(null);

  const toggleExpand = (key: string) => {
    setExpandedKey(expandedKey === key ? null : key);
  };

  const openDetail = (item: FeedItem) => {
    const config = categoryConfig[item.tag];
    setModalData({
      title: item.title,
      source: item.source,
      time: item.time,
      tag: item.tag,
      tagVariant: config.variant,
      sentiment: item.detail.sentiment,
      impact: item.detail.impact,
      keyPoints: item.detail.keyPoints,
      analysis: item.detail.analysis,
      relatedTickers: item.detail.relatedTickers,
    });
  };

  const groups = GROUP_ORDER.map((cat) => ({
    category: cat,
    items: newsItems.filter((item) => item.tag === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      <div className="space-y-5 p-3">
        {groups.map((group) => {
          const config = categoryConfig[group.category];
          const Icon = categoryIcon[group.category];
          return (
            <div key={group.category}>
              {/* Section header */}
              <div className="mb-2 flex items-center gap-2">
                <span className={cn('text-3xs font-semibold uppercase tracking-[0.15em]', config.color)}>
                  {group.category}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Cards */}
              <div className="space-y-1.5">
                {group.items.map((item) => {
                  const expanded = expandedKey === item.title;
                  return (
                    <div
                      key={item.title}
                      className={cn(
                        'cursor-pointer rounded-xl bg-bg-tertiary transition-all',
                        expanded ? 'ring-1 ring-border-light' : 'hover:bg-bg-hover',
                      )}
                      onClick={() => toggleExpand(item.title)}
                      role="button"
                      tabIndex={0}
                      aria-expanded={expanded}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleExpand(item.title);
                        }
                      }}
                    >
                      {/* Card header */}
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <div
                          className={cn(
                            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg',
                            config.iconBg,
                          )}
                        >
                          <Icon className={cn('h-4.5 w-4.5', config.color)} />
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <span className={cn('text-3xs font-semibold uppercase tracking-[0.1em]', config.color)}>
                            {item.tag}
                          </span>
                          <p className="text-xs font-medium leading-snug text-text-primary">{item.title}</p>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-1 self-start">
                          <span className="text-2xs text-text-muted">{item.time}</span>
                          <ChevronIcon expanded={expanded} />
                        </div>
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
                            <p className="mt-2 text-2xs leading-relaxed text-text-secondary">{item.preview}</p>
                            <button
                              className="mt-2 text-2xs font-medium text-accent-primary transition-colors hover:text-accent-secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDetail(item);
                              }}
                            >
                              View full analysis &rarr;
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <FeedDetailModal open={modalData !== null} onClose={() => setModalData(null)} data={modalData} />
    </>
  );
}
