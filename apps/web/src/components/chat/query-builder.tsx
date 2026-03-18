import type { ReactNode } from 'react';

interface QuerySuggestion {
  icon: ReactNode;
  label: string;
  query: string;
}

interface QueryBuilderProps {
  suggestions?: QuerySuggestion[];
  onSelect: (query: string) => void;
}

const defaultSuggestions: QuerySuggestion[] = [
  {
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
      <div className="mb-4 flex items-center justify-center gap-2.5">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="text-accent-primary">
          <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2zM12 14l1.5 4.5L18 20l-4.5 1.5L12 26l-1.5-4.5L6 20l4.5-1.5L12 14z" />
        </svg>
        <h2 className="text-base font-semibold text-text-primary">Let&apos;s knock something off your list</h2>
      </div>

      {/* Suggestion grid */}
      <div className="grid grid-cols-2 gap-2">
        {suggestions.map((s) => (
          <button
            key={s.label}
            onClick={() => onSelect(s.query)}
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
