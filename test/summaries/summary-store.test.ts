/**
 * SummaryStore tests — focused on the supersede path used by the micro
 * priority gate.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SummaryStore } from '../../src/summaries/summary-store.js';
import type { Summary } from '../../src/summaries/types.js';

function makeSummary(overrides: Partial<Summary> = {}): Summary {
  const now = new Date().toISOString();
  return {
    id: `s-${Math.random().toString(36).slice(2, 10)}`,
    what: 'Review AAPL',
    why: 'unit test',
    source: 'micro-observation: AAPL',
    severity: 0.5,
    status: 'PENDING',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now,
    ...overrides,
  };
}

describe('SummaryStore.supersede', () => {
  let dir: string;
  let store: SummaryStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'summary-store-test-'));
    store = new SummaryStore({ dir });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('marks a pending summary as EXPIRED with resolvedBy=superseded', async () => {
    const summary = makeSummary();
    await store.create(summary);

    const result = await store.supersede(summary.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe('EXPIRED');
    expect(result.data.resolvedBy).toBe('superseded');
    expect(result.data.resolvedAt).toBeDefined();
  });

  it('refuses to supersede an already-resolved summary', async () => {
    const summary = makeSummary();
    await store.create(summary);
    await store.approve(summary.id);

    const result = await store.supersede(summary.id);
    expect(result.success).toBe(false);
  });

  it('superseded summaries no longer appear in getPending', async () => {
    const a = makeSummary({ id: 's-1', severity: 0.3 });
    const b = makeSummary({ id: 's-2', severity: 0.9 });
    await store.create(a);
    await store.create(b);

    await store.supersede('s-1');

    const pending = await store.getPending();
    expect(pending.map((p) => p.id)).toEqual(['s-2']);
  });

  it('persists the severity score on create/query roundtrip', async () => {
    await store.create(makeSummary({ id: 's-sev', severity: 0.72 }));
    const pending = await store.getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].severity).toBe(0.72);
  });
});

describe('SummaryStore.dismiss', () => {
  let dir: string;
  let store: SummaryStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'summary-store-dismiss-'));
    store = new SummaryStore({ dir });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('sets dismissedAt on a pending summary', async () => {
    const summary = makeSummary();
    await store.create(summary);
    const result = await store.dismiss(summary.id);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dismissedAt).toBeDefined();
      expect(result.data.id).toBe(summary.id);
    }
  });

  it('returns error for non-existent summary', async () => {
    const result = await store.dismiss('non-existent-id');
    expect(result.success).toBe(false);
  });

  it('returns error for already dismissed summary', async () => {
    const summary = makeSummary();
    await store.create(summary);
    await store.dismiss(summary.id);
    const result = await store.dismiss(summary.id);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('already dismissed');
  });

  it('returns error for non-PENDING summary', async () => {
    const summary = makeSummary();
    await store.create(summary);
    await store.approve(summary.id);
    const result = await store.dismiss(summary.id);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('APPROVED');
  });

  it('auto-expires if summary has passed expiresAt', async () => {
    const summary = makeSummary({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    await store.create(summary);
    const result = await store.dismiss(summary.id);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('expired');
  });

  it('dismissed summaries are excluded from getPending', async () => {
    const summary = makeSummary();
    await store.create(summary);
    await store.dismiss(summary.id);
    const pending = await store.getPending();
    expect(pending).toHaveLength(0);
  });

  it('dismissed summaries are excluded from query by default', async () => {
    const summary = makeSummary();
    await store.create(summary);
    await store.dismiss(summary.id);
    const results = await store.query({ status: 'PENDING' });
    expect(results).toHaveLength(0);
  });

  it('dismissed summaries are included when dismissed=true', async () => {
    const summary = makeSummary();
    await store.create(summary);
    await store.dismiss(summary.id);
    const results = await store.query({ dismissed: true });
    expect(results).toHaveLength(1);
    expect(results[0].dismissedAt).toBeDefined();
  });

  it('query without dismissed filter excludes dismissed summaries', async () => {
    const a1 = makeSummary({ id: 's-vis' });
    const a2 = makeSummary({ id: 's-dis' });
    await store.create(a1);
    await store.create(a2);
    await store.dismiss('s-dis');

    const results = await store.query({});
    const ids = results.map((r) => r.id);
    expect(ids).toContain('s-vis');
    expect(ids).not.toContain('s-dis');
  });
});

describe('SummaryStore.hasPendingTrigger', () => {
  let dir: string;
  let store: SummaryStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'summary-store-trigger-'));
    store = new SummaryStore({ dir });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns true when a PENDING summary with matching triggerId exists', async () => {
    await store.create(makeSummary({ id: 's-1', triggerId: 'skill-RSI-AAPL' }));
    expect(await store.hasPendingTrigger('skill-RSI-AAPL')).toBe(true);
  });

  it('returns false when no summary has the triggerId', async () => {
    await store.create(makeSummary({ id: 's-1', triggerId: 'skill-RSI-AAPL' }));
    expect(await store.hasPendingTrigger('skill-RSI-GOOG')).toBe(false);
  });

  it('returns false when the matching summary is APPROVED (no longer PENDING)', async () => {
    await store.create(makeSummary({ id: 's-1', triggerId: 'skill-RSI-AAPL' }));
    await store.approve('s-1');
    expect(await store.hasPendingTrigger('skill-RSI-AAPL')).toBe(false);
  });

  it('returns false when the matching summary is REJECTED', async () => {
    await store.create(makeSummary({ id: 's-1', triggerId: 'skill-RSI-AAPL' }));
    await store.reject('s-1');
    expect(await store.hasPendingTrigger('skill-RSI-AAPL')).toBe(false);
  });

  it('returns false when the matching summary is dismissed', async () => {
    await store.create(makeSummary({ id: 's-1', triggerId: 'skill-RSI-AAPL' }));
    await store.dismiss('s-1');
    expect(await store.hasPendingTrigger('skill-RSI-AAPL')).toBe(false);
  });

  it('returns false when the matching summary has expired', async () => {
    await store.create(
      makeSummary({
        id: 's-1',
        triggerId: 'skill-RSI-AAPL',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      }),
    );
    expect(await store.hasPendingTrigger('skill-RSI-AAPL')).toBe(false);
  });

  it('returns false when store is empty', async () => {
    expect(await store.hasPendingTrigger('skill-RSI-AAPL')).toBe(false);
  });

  it('returns true when multiple summaries exist and one PENDING matches', async () => {
    await store.create(makeSummary({ id: 's-1', triggerId: 'skill-RSI-AAPL' }));
    await store.approve('s-1');
    // Second summary with same triggerId, still PENDING
    await store.create(makeSummary({ id: 's-2', triggerId: 'skill-RSI-AAPL' }));
    expect(await store.hasPendingTrigger('skill-RSI-AAPL')).toBe(true);
  });
});
