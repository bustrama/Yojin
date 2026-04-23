import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PositionInsight } from '../../api/types';
import { cn } from '../../lib/utils';
import { renderNodeToPng } from '../../lib/share-image';
import { ShareCard } from './share-card';

interface ShareMenuProps {
  insight: PositionInsight;
  className?: string;
  /** Icon-only trigger for tight CTA rows. Defaults to showing the "Share" label. */
  compact?: boolean;
}

export function ShareMenu({ insight, className, compact = false }: ShareMenuProps) {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4000);
  };

  const handleShare = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await renderNodeToPng(<ShareCard insight={insight} />);
      const file = new File([blob], `yojin-${insight.symbol}.png`, { type: 'image/png' });

      // Prefer the native share sheet when the browser can share files
      // (Safari/iOS, Chrome Android, most modern mobile browsers, macOS Safari).
      // Users pick Telegram/WhatsApp/Mail/etc. directly from the OS picker.
      // Pass ONLY the file — if `title`/`text` is also provided, the macOS
      // Telegram share extension (and some others) prioritises the text and
      // drops the image, which defeats the whole point.
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return;
        } catch (err) {
          // AbortError fires when the user dismisses the sheet — silent.
          if (err instanceof Error && err.name === 'AbortError') return;
          // Any other failure: fall through to clipboard.
        }
      }

      // Fallback for desktop Chrome/Firefox where file-sharing isn't supported.
      const item = new ClipboardItem({ 'image/png': Promise.resolve(blob) });
      await navigator.clipboard.write([item]);
      showToast('Image copied — paste (⌘/Ctrl+V) into any chat');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to share image');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn('relative inline-block', className)}>
      <button
        type="button"
        onClick={handleShare}
        aria-label="Share insight"
        disabled={busy}
        className={cn(
          'inline-flex w-full items-center justify-center rounded-lg border border-border bg-bg-card text-xs font-medium text-text-primary hover:bg-bg-hover transition-colors cursor-pointer gap-1.5 px-2.5 py-1.5 h-7 disabled:cursor-not-allowed disabled:opacity-40',
        )}
      >
        <ShareIcon className={cn('h-3.5 w-3.5', busy && 'animate-spin')} />
        {compact ? <span className="sr-only">Share</span> : busy ? 'Sharing…' : 'Share'}
      </button>

      {toast &&
        createPortal(
          <div className="fixed bottom-6 right-6 z-[1000] max-w-sm rounded-lg border border-border bg-bg-card px-4 py-2.5 text-xs text-text-primary shadow-lg">
            {toast}
          </div>,
          document.body,
        )}
    </div>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
      />
    </svg>
  );
}
