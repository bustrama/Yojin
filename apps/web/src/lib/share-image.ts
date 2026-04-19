import { createRoot } from 'react-dom/client';
import { toBlob } from 'html-to-image';
import type { ReactNode } from 'react';

/**
 * Mount `node` off-screen, wait for fonts, snapshot to PNG, unmount.
 * The node must render a self-contained element with a fixed width;
 * the height grows to fit content so all data is captured.
 */
export async function renderNodeToPng(node: ReactNode): Promise<Blob> {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.top = '-10000px';
  host.style.left = '-10000px';
  host.style.pointerEvents = 'none';
  host.setAttribute('aria-hidden', 'true');
  document.body.appendChild(host);

  const root = createRoot(host);
  try {
    root.render(node);
    // React 19 commits asynchronously — poll for the mounted child instead of
    // assuming one rAF is enough. Cap at ~1s so we fail loud if something is
    // really wrong.
    const target = await waitForChild(host, 1000);
    if (!target) throw new Error('Share card failed to mount');
    const blob = await toBlob(target, {
      pixelRatio: 2,
      cacheBust: false,
      skipFonts: true,
    });
    if (!blob) throw new Error('Failed to render share image');
    return blob;
  } finally {
    root.unmount();
    host.remove();
  }
}

async function waitForChild(host: HTMLElement, timeoutMs: number): Promise<HTMLElement | null> {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    const el = host.firstElementChild as HTMLElement | null;
    if (el) {
      // Give the browser one frame so layout is settled before snapshot.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      return el;
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  return null;
}
