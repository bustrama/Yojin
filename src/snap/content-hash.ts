/**
 * Stable content hashing for Snap briefs.
 *
 * The snap ID is derived from this hash so that regenerating an unchanged
 * brief preserves the same `id` — graphcache treats it as the same entity and
 * downstream consumers (notification dedup, UI glow effects) only fire when
 * the semantic content actually changes.
 *
 * Scope of the hash: the top-level fields the user sees in the Snap card —
 * `intelSummary` + each action item's text. Per-asset snaps (`assetSnaps`)
 * have their own identities via the MicroInsight pipeline and intentionally
 * fall outside this hash; including them would churn the snap ID on every
 * micro-cycle even when the portfolio-level synthesis is unchanged.
 */

import { createHash } from 'node:crypto';

export interface HashableSnap {
  intelSummary?: string;
  actionItems: { text: string }[];
}

/** Stable SHA-256 hex digest of the snap's visible portfolio-level content. */
export function computeSnapContentHash(snap: HashableSnap): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        intelSummary: snap.intelSummary ?? '',
        actionItems: snap.actionItems.map((a) => a.text),
      }),
    )
    .digest('hex');
}

/**
 * Derive a stable snap ID from a content hash. Same content → same ID across
 * regenerations, so graphcache and notification cooldowns can key on `id`
 * alone without comparing content.
 */
export function snapIdFromHash(hash: string): string {
  return `snap-${hash.slice(0, 12)}`;
}
