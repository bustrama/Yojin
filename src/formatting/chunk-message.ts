/**
 * Split a long message into chunks that fit within a character limit.
 * Prefers splitting at paragraph boundaries (\n\n), then line boundaries (\n),
 * then hard-cuts if no boundary is found.
 */
export function chunkMessage(text: string, limit: number): string[] {
  if (text.length <= limit) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > limit) {
    let splitIdx = remaining.lastIndexOf('\n\n', limit);
    if (splitIdx > 0) {
      chunks.push(remaining.slice(0, splitIdx));
      remaining = remaining.slice(splitIdx + 2);
      continue;
    }

    splitIdx = remaining.lastIndexOf('\n', limit);
    if (splitIdx > 0) {
      chunks.push(remaining.slice(0, splitIdx));
      remaining = remaining.slice(splitIdx + 1);
      continue;
    }

    chunks.push(remaining.slice(0, limit));
    remaining = remaining.slice(limit);
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}
