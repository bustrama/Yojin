import { useLocation } from 'react-router';

const pageTitles: Record<string, string> = {
  '/': 'Overview',
  '/chat': 'Chat',
  '/portfolio': 'Portfolio',
  '/skills': 'Skills',
  '/profile': 'Profile',
  '/settings': 'Settings',
};

export default function AppHeader() {
  const { pathname } = useLocation();
  const title = pageTitles[pathname] ?? pathname.split('/').filter(Boolean).pop() ?? '';

  return (
    <header className="flex h-12 flex-shrink-0 items-center justify-between border-b border-border bg-bg-secondary px-5">
      <h1 className="text-sm font-medium text-text-primary">{title}</h1>

      <div className="flex items-center gap-3">
        {/* Search placeholder */}
        <button className="flex h-7 items-center gap-2 rounded-lg border border-border bg-bg-tertiary px-2.5 text-2xs text-text-muted transition-colors hover:border-border-light hover:text-text-secondary">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <span>Search...</span>
          <kbd className="rounded border border-border bg-bg-primary px-1 py-0.5 text-3xs text-text-muted">/</kbd>
        </button>

        {/* Notifications */}
        <button className="relative flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-hover hover:text-text-secondary">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
            />
          </svg>
          {/* Notification dot */}
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent-primary" />
        </button>

        {/* User avatar */}
        <button className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-primary/15 text-2xs font-medium text-accent-primary transition-colors hover:bg-accent-primary/25">
          DS
        </button>
      </div>
    </header>
  );
}
