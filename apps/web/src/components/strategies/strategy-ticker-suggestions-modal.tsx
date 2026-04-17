import { useEffect, useState } from 'react';

import Modal from '../common/modal.js';
import Spinner from '../common/spinner.js';
import { useAddToWatchlist, useSuggestTickersForStrategy } from '../../api/hooks/index.js';
import type { TickerSuggestion } from '../../api/types.js';
import { cn } from '../../lib/utils.js';

interface Props {
  strategyId: string;
  strategyName: string;
  onClose: () => void;
}

type AddState = 'idle' | 'adding' | 'added' | { error: string };

export default function StrategyTickerSuggestionsModal({ strategyId, strategyName, onClose }: Props) {
  const suggestTickers = useSuggestTickersForStrategy();
  const [, addToWatchlist] = useAddToWatchlist();

  // Parent mounts this component keyed by strategyId, so state always starts fresh
  // for a given activation — no reset-in-effect needed.
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<TickerSuggestion[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addState, setAddState] = useState<Record<string, AddState>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    suggestTickers({ id: strategyId })
      .then((result) => {
        if (cancelled) return;
        if (result.error) {
          setFetchError(result.error.message);
          return;
        }
        const items = result.data?.suggestTickersForStrategy ?? [];
        setSuggestions(items);
        // Pre-select high-confidence picks so the user can one-click "Add selected".
        const preselected = new Set(items.filter((s) => s.confidence >= 0.7).map((s) => s.symbol));
        setSelected(preselected);
      })
      .catch((err: unknown) => {
        if (!cancelled) setFetchError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [strategyId, suggestTickers]);

  function toggleSelect(symbol: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  }

  async function handleAddSelected(): Promise<void> {
    if (!suggestions || selected.size === 0 || submitting) return;
    setSubmitting(true);
    const picks = suggestions.filter((s) => selected.has(s.symbol) && addState[s.symbol] !== 'added');
    for (const pick of picks) {
      setAddState((prev) => ({ ...prev, [pick.symbol]: 'adding' }));
      const result = await addToWatchlist({ symbol: pick.symbol, name: pick.name, assetClass: pick.assetClass });
      const requestError = result.error;
      if (requestError) {
        setAddState((prev) => ({ ...prev, [pick.symbol]: { error: requestError.message } }));
        continue;
      }
      const payload = result.data?.addToWatchlist;
      if (payload && !payload.success) {
        setAddState((prev) => ({ ...prev, [pick.symbol]: { error: payload.error ?? 'Failed to add' } }));
        continue;
      }
      setAddState((prev) => ({ ...prev, [pick.symbol]: 'added' }));
    }
    setSubmitting(false);
  }

  const headerCount = suggestions ? suggestions.length : 0;
  const selectedCount = selected.size;
  const addedCount = Object.values(addState).filter((s) => s === 'added').length;

  return (
    <Modal open onClose={onClose} title={`Add tickers for ${strategyName}`} maxWidth="max-w-2xl">
      <div className="space-y-4 text-sm text-text-secondary">
        <p className="text-xs text-text-muted">
          Strategies look for opportunities across your watchlist — not just your portfolio. We asked the AI to propose
          tickers that fit this strategy and aren&rsquo;t already in your portfolio or watchlist. Pick which to add.
        </p>

        {fetching && (
          <div className="flex items-center justify-center py-12">
            <Spinner label="Asking the AI for ticker ideas..." />
          </div>
        )}

        {fetchError && (
          <div className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">{fetchError}</div>
        )}

        {!fetching && !fetchError && suggestions && suggestions.length === 0 && (
          <div className="rounded-lg border border-border bg-bg-tertiary px-3 py-4 text-center text-xs text-text-muted">
            No new tickers to suggest for this strategy right now.
          </div>
        )}

        {!fetching && suggestions && suggestions.length > 0 && (
          <>
            <div className="flex items-center justify-between text-2xs uppercase tracking-wide text-text-muted">
              <span>
                {headerCount} suggestion{headerCount === 1 ? '' : 's'} · {selectedCount} selected
              </span>
              {addedCount > 0 && <span className="text-success">{addedCount} added</span>}
            </div>

            <ul className="space-y-2 max-h-[50vh] overflow-auto pr-1">
              {suggestions.map((s) => {
                const state = addState[s.symbol] ?? 'idle';
                const isAdded = state === 'added';
                const isAdding = state === 'adding';
                const errorMsg = typeof state === 'object' ? state.error : null;
                const isChecked = selected.has(s.symbol);
                return (
                  <li
                    key={s.symbol}
                    className={cn(
                      'rounded-lg border border-border bg-bg-tertiary px-3 py-2.5 transition-colors',
                      isAdded && 'border-success/40 bg-success/10',
                      errorMsg && 'border-error/40 bg-error/10',
                    )}
                  >
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isAdded || isAdding}
                        onChange={() => toggleSelect(s.symbol)}
                        className="mt-1 h-4 w-4 cursor-pointer accent-accent-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-text-primary">{s.symbol}</span>
                          <span className="truncate text-xs text-text-secondary">{s.name}</span>
                          <span className="ml-auto flex items-center gap-2 text-2xs text-text-muted">
                            <span className="rounded bg-bg-secondary px-1.5 py-0.5">{s.assetClass}</span>
                            <span>{(s.confidence * 100).toFixed(0)}%</span>
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-text-secondary">{s.rationale}</p>
                        {isAdded && <p className="mt-1 text-2xs font-medium text-success">Added to watchlist</p>}
                        {isAdding && <p className="mt-1 text-2xs text-text-muted">Adding...</p>}
                        {errorMsg && <p className="mt-1 text-2xs text-error">{errorMsg}</p>}
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-hover"
          >
            Done
          </button>
          <button
            type="button"
            disabled={!suggestions || selectedCount === 0 || submitting || fetching}
            onClick={handleAddSelected}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
              !suggestions || selectedCount === 0 || submitting || fetching
                ? 'cursor-not-allowed bg-bg-tertiary text-text-muted'
                : 'bg-accent-primary text-white hover:opacity-90',
            )}
          >
            {submitting ? 'Adding...' : `Add ${selectedCount || ''} to watchlist`.trim()}
          </button>
        </div>
      </div>
    </Modal>
  );
}
