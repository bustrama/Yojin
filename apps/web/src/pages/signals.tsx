import { useState } from 'react';

import type { Signal } from '../api/types';
import type { BadgeVariant } from '../components/common/badge';
import Badge from '../components/common/badge';
import Card from '../components/common/card';
import Spinner from '../components/common/spinner';
import { usePositions, useSignals } from '../api/hooks';

const signalTypeBadge: Record<string, { variant: BadgeVariant; label: string }> = {
  MACRO: { variant: 'info', label: 'Macro' },
  FUNDAMENTAL: { variant: 'success', label: 'Fundamental' },
  SENTIMENT: { variant: 'warning', label: 'Sentiment' },
  TECHNICAL: { variant: 'neutral', label: 'Technical' },
  NEWS: { variant: 'neutral', label: 'News' },
};

const TYPE_OPTIONS = ['ALL', 'PORTFOLIO', 'MACRO', 'FUNDAMENTAL', 'SENTIMENT', 'TECHNICAL', 'NEWS'] as const;

const CONFIDENCE_LEVELS = [
  { value: 0, label: 'All' },
  { value: 0.5, label: '50%+' },
  { value: 0.7, label: '70%+' },
  { value: 0.85, label: '85%+' },
] as const;

export default function Signals() {
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [minConfidence, setMinConfidence] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const isPortfolioFilter = typeFilter === 'PORTFOLIO';
  const [{ data, fetching }] = useSignals({
    type: typeFilter === 'ALL' || isPortfolioFilter ? undefined : typeFilter,
    search: search || undefined,
    minConfidence: minConfidence > 0 ? minConfidence : undefined,
    limit: 100,
  });
  const [{ data: posData }] = usePositions();

  const positions = posData?.positions ?? [];
  const heldSymbols = new Set(positions.map((p) => p.symbol.toUpperCase()));
  const heldSectors = new Set(
    positions.map((p) => p.sector?.toLowerCase()).filter((s): s is string => s != null && s !== ''),
  );

  const allSignals = data?.signals ?? [];
  const signals = isPortfolioFilter
    ? allSignals.filter((s) => isPortfolioRelevant(s, heldSymbols, heldSectors))
    : allSignals;

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSearch(searchInput.trim());
  }

  return (
    <div className="flex-1 overflow-auto p-6 space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {TYPE_OPTIONS.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                typeFilter === t
                  ? 'bg-accent-primary text-white'
                  : 'bg-bg-tertiary text-text-muted hover:text-text-primary'
              }`}
            >
              {t === 'ALL' ? 'All' : t === 'PORTFOLIO' ? 'My Portfolio' : (signalTypeBadge[t]?.label ?? t)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-text-muted">Quality:</span>
          {CONFIDENCE_LEVELS.map((level) => (
            <button
              key={level.value}
              onClick={() => setMinConfidence(level.value)}
              className={`rounded-full px-2 py-0.5 text-2xs font-medium transition-colors ${
                minConfidence === level.value
                  ? 'bg-accent-primary/20 text-accent-primary'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {level.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 ml-auto">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search signals..."
            className="rounded-lg border border-border bg-bg-primary px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none w-56"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSearchInput('');
              }}
              className="text-xs text-text-muted hover:text-text-primary"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Results */}
      <Card section>
        {fetching ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : signals.length === 0 ? (
          <p className="py-12 text-center text-sm text-text-muted">
            {search || typeFilter !== 'ALL' || minConfidence > 0
              ? 'No signals match your filters. Try lowering the quality threshold.'
              : 'No signals ingested yet. Add a data source and fetch some data.'}
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-text-muted mb-3">
              {signals.length} signal{signals.length !== 1 ? 's' : ''}
              {isPortfolioFilter && ' relevant to your portfolio'}
              {!isPortfolioFilter &&
                typeFilter !== 'ALL' &&
                ` of type ${signalTypeBadge[typeFilter]?.label ?? typeFilter}`}
              {search && ` matching "${search}"`}
            </p>
            {signals.map((signal: Signal) => {
              const badge = signalTypeBadge[signal.type] ?? {
                variant: 'neutral' as BadgeVariant,
                label: signal.type,
              };
              return (
                <div key={signal.id} className="rounded-lg border border-border bg-bg-card px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={badge.variant} size="xs">
                          {badge.label}
                        </Badge>
                        <span className="text-2xs text-text-muted">{signal.sourceName}</span>
                        <span className="text-2xs text-text-muted">
                          {new Date(signal.publishedAt).toLocaleDateString()}
                        </span>
                      </div>
                      {signal.link ? (
                        <a
                          href={signal.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-text-primary hover:text-accent-primary transition-colors line-clamp-2"
                        >
                          {signal.title}
                        </a>
                      ) : (
                        <p className="text-sm font-medium text-text-primary line-clamp-2">{signal.title}</p>
                      )}
                      {signal.tickers.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {signal.tickers.map((t: string) => {
                            const held = heldSymbols.has(t.toUpperCase());
                            return (
                              <span
                                key={t}
                                className={`text-2xs font-mono px-1.5 py-0.5 rounded ${
                                  held
                                    ? 'text-success bg-success/10 ring-1 ring-success/30'
                                    : 'text-accent-primary bg-accent-primary/10'
                                }`}
                                title={held ? `${t} — in your portfolio` : t}
                              >
                                {t}
                                {held && ' \u2713'}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {signal.confidence > 0 && (
                      <span className="text-2xs text-text-muted shrink-0">{Math.round(signal.confidence * 100)}%</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Portfolio relevance — matches signals beyond direct ticker mentions
// ---------------------------------------------------------------------------

/** Sector keywords found in signal titles/content that map to GICS sectors. */
const SECTOR_KEYWORDS: Record<string, string[]> = {
  technology: [
    'tech',
    'software',
    'semiconductor',
    'chip',
    'ai ',
    'artificial intelligence',
    'cloud computing',
    'saas',
    'cybersecurity',
  ],
  'health care': ['healthcare', 'pharma', 'biotech', 'fda', 'drug', 'medical', 'hospital'],
  financials: ['bank', 'banking', 'financial', 'insurance', 'lending', 'mortgage', 'credit'],
  energy: ['oil', 'natural gas', 'crude', 'opec', 'drilling', 'petroleum', 'renewable energy', 'solar', 'wind energy'],
  'consumer discretionary': ['retail', 'e-commerce', 'luxury', 'auto', 'automotive', 'housing', 'consumer spending'],
  'consumer staples': ['grocery', 'food', 'beverage', 'tobacco', 'household'],
  industrials: ['manufacturing', 'aerospace', 'defense', 'logistics', 'construction', 'infrastructure'],
  materials: ['mining', 'steel', 'copper', 'gold', 'lithium', 'chemical', 'commodity'],
  utilities: ['utility', 'electric', 'power grid', 'water utility', 'natural gas utility'],
  'real estate': ['real estate', 'reit', 'housing market', 'commercial property', 'mortgage rate'],
  'communication services': ['media', 'streaming', 'telecom', 'advertising', 'social media'],
};

function isPortfolioRelevant(signal: Signal, heldSymbols: Set<string>, heldSectors: Set<string>): boolean {
  // Direct ticker match
  if (signal.tickers.some((t) => heldSymbols.has(t.toUpperCase()))) return true;

  // MACRO signals affect the entire portfolio (fed rates, inflation, GDP)
  if (signal.type === 'MACRO') return true;

  // Sector match — signal content mentions a sector the user is exposed to
  if (heldSectors.size > 0) {
    const text = `${signal.title} ${signal.content ?? ''}`.toLowerCase();
    for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
      if (heldSectors.has(sector) && keywords.some((kw) => text.includes(kw))) {
        return true;
      }
    }
  }

  return false;
}
