import type { ReactNode } from 'react';

interface QuerySuggestion {
  id: string;
  icon: ReactNode;
  label: string;
  query: string;
}

interface QueryBuilderProps {
  suggestions?: QuerySuggestion[];
  onSelect: (id: string) => void;
}

const defaultSuggestions: QuerySuggestion[] = [
  {
    id: 'portfolio',
    icon: (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 20V10M12 20V4M6 20v-6" />
      </svg>
    ),
    label: 'Portfolio',
    query: 'How is my portfolio performing today?',
  },
  {
    id: 'risk',
    icon: (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
    label: 'Risk & Exposure',
    query: 'Analyze my current risk exposure',
  },
  {
    id: 'positions',
    icon: (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
      </svg>
    ),
    label: 'Positions',
    query: 'Show me my top performing positions',
  },
  {
    id: 'trends',
    icon: (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    label: 'Trends',
    query: 'What market trends should I watch?',
  },
];

export default function QueryBuilder({ suggestions = defaultSuggestions, onSelect }: QueryBuilderProps) {
  return (
    <div>
      {/* Header with star icon */}
      <div className="my-8 flex items-center justify-center gap-2.5">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-accent-primary">
          <path
            d="M12 2l.9 2.8a2 2 0 001.3 1.3L17 7l-2.8.9a2 2 0 00-1.3 1.3L12 12l-.9-2.8a2 2 0 00-1.3-1.3L7 7l2.8-.9a2 2 0 001.3-1.3L12 2z"
            fill="currentColor"
          />
          <path
            d="M18 14l.6 1.8a1 1 0 00.6.6L21 17l-1.8.6a1 1 0 00-.6.6L18 20l-.6-1.8a1 1 0 00-.6-.6L15 17l1.8-.6a1 1 0 00.6-.6L18 14z"
            fill="currentColor"
            opacity="0.7"
          />
          <path
            d="M7 16l.4 1.2a1 1 0 00.4.4L9 18l-1.2.4a1 1 0 00-.4.4L7 20l-.4-1.2a1 1 0 00-.4-.4L5 18l1.2-.4a1 1 0 00.4-.4L7 16z"
            fill="currentColor"
            opacity="0.5"
          />
        </svg>
        <h2 className="text-base font-semibold text-text-primary">Let&apos;s knock something off your list</h2>
      </div>

      {/* Suggestion grid */}
      <div className="grid grid-cols-2 gap-2">
        {suggestions.map((s) => (
          <button
            key={s.label}
            onClick={() => onSelect(s.id)}
            className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border/60 bg-bg-secondary px-3.5 py-2.5 text-left transition-all hover:border-border-light hover:bg-bg-hover"
          >
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-bg-tertiary text-text-muted">
              {s.icon}
            </div>
            <span className="text-xs font-medium text-text-primary">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
