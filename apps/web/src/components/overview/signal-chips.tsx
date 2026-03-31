import { useNavigate } from 'react-router';

import { useSignalModal } from '../../lib/signal-modal-context';

export interface SignalMapEntry {
  title: string;
  url: string | null;
  sourceCount?: number;
}

export interface ResolvedSignal {
  signalId: string;
  title: string;
  url: string | null;
  sourceCount?: number;
}

type SignalChipsProps = {
  /** @deprecated No longer used — signals open in a modal now. */
  navigate?: ReturnType<typeof useNavigate>;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
} & (
  | { signalIds: string[]; signalMap: Map<string, SignalMapEntry>; signals?: never }
  | { signals: ResolvedSignal[]; signalIds?: never; signalMap?: never }
);

export function SignalChips(props: SignalChipsProps) {
  const { className, onClick } = props;
  const { openSignals } = useSignalModal();

  // Collect all signal IDs regardless of whether they resolve in the map
  const allIds: string[] =
    'signals' in props && props.signals ? props.signals.map((s) => s.signalId) : (props.signalIds ?? []);

  if (allIds.length === 0) return null;

  // Try to resolve titles from the map for richer display
  const resolved =
    'signals' in props && props.signals
      ? props.signals.map((s) => ({ id: s.signalId, title: s.title, sourceCount: s.sourceCount }))
      : (allIds
          .map((id) => {
            const entry = (props.signalMap ?? new Map<string, SignalMapEntry>()).get(id);
            return { id, title: entry?.title, sourceCount: entry?.sourceCount };
          })
          .filter((s) => !!s.title) as { id: string; title: string; sourceCount?: number }[]);

  // If we have IDs but no resolved titles, show a single "View signals" button
  if (resolved.length === 0) {
    return (
      <div className={className ?? 'mt-1 flex flex-wrap gap-1'}>
        <button
          type="button"
          onClick={(e) => {
            onClick?.(e);
            openSignals(allIds);
          }}
          className="inline-flex cursor-pointer items-center gap-1 rounded bg-bg-secondary px-1.5 py-0.5 text-[11px] text-accent-primary transition-colors hover:bg-accent-primary/10"
        >
          <svg
            className="h-2.5 w-2.5 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
            />
          </svg>
          <span>
            {allIds.length} signal{allIds.length !== 1 ? 's' : ''}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className={className ?? 'mt-1 flex flex-wrap gap-1'}>
      {resolved.map((sig) => (
        <button
          key={sig.id}
          type="button"
          onClick={(e) => {
            onClick?.(e);
            openSignals(allIds);
          }}
          className="inline-flex cursor-pointer items-center gap-1 rounded bg-bg-secondary px-1.5 py-0.5 text-[11px] text-accent-primary transition-colors hover:bg-accent-primary/10"
          title={sig.title}
        >
          <svg
            className="h-2.5 w-2.5 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
            />
          </svg>
          <span className="max-w-[120px] truncate">{sig.title}</span>
          {sig.sourceCount != null && sig.sourceCount > 1 && (
            <span className="ml-1 text-[10px] text-text-muted">×{sig.sourceCount}</span>
          )}
        </button>
      ))}
    </div>
  );
}
