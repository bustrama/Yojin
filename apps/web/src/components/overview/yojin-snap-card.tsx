export default function YojinSnapCard() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-border bg-bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary font-headline">Yojin Snap</h3>
        <span className="rounded-md bg-bg-tertiary px-2.5 py-1 text-2xs text-text-muted">Coming soon</span>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <p className="max-w-xs text-center text-sm leading-relaxed text-text-secondary">
          A live intelligence surface for a quick brief. It answers: &ldquo;Right now, where do I stand and what
          deserves my attention?&rdquo;
        </p>
      </div>
    </div>
  );
}
