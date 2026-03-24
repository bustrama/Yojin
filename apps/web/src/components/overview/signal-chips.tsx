import { useNavigate } from 'react-router';

export interface SignalMapEntry {
  title: string;
  url: string | null;
}

export function SignalChips({
  signalIds,
  signalMap,
  navigate,
}: {
  signalIds: string[];
  signalMap: Map<string, SignalMapEntry>;
  navigate: ReturnType<typeof useNavigate>;
}) {
  if (signalIds.length === 0) return null;
  const resolved = signalIds.map((id) => ({ id, ...signalMap.get(id) })).filter((s) => s.title);
  if (resolved.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {resolved.map((sig) => (
        <a
          key={sig.id}
          href={sig.url ?? `/signals?highlight=${sig.id}`}
          target={sig.url ? '_blank' : undefined}
          rel={sig.url ? 'noopener noreferrer' : undefined}
          onClick={(e) => {
            if (!sig.url) {
              e.preventDefault();
              navigate(`/signals?highlight=${sig.id}`);
            }
          }}
          className="inline-flex items-center gap-1 rounded bg-bg-secondary px-1.5 py-0.5 text-[11px] text-accent-primary transition-colors hover:bg-accent-primary/10"
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
        </a>
      ))}
    </div>
  );
}
