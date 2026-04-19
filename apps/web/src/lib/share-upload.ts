/**
 * Upload a PNG blob via the local /api/share-upload proxy.
 *
 * The proxy forwards the file to catbox.moe server-side. catbox has no CORS
 * headers, so browser uploads fail — the local backend handles the egress.
 * Uploaded files are permanent (catbox's policy); platform share-intents
 * unfurl the returned URL into an image preview in Telegram / WhatsApp / X.
 */
export async function uploadShareImage(blob: Blob, filename: string): Promise<string> {
  const form = new FormData();
  form.append('file', blob, filename);
  const res = await fetch('/api/share-upload', { method: 'POST', body: form });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Image upload failed (${res.status})${text ? `: ${text.slice(0, 120)}` : ''}`);
  }
  const { url, error } = (await res.json()) as { url?: string; error?: string };
  if (!url) throw new Error(error ?? 'Upload returned no URL');
  return url;
}
