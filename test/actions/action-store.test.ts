/**
 * ActionStore tests — focused on the supersede path used by the micro
 * priority gate.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ActionStore } from '../../src/actions/action-store.js';
import type { Action } from '../../src/actions/types.js';

function makeAction(overrides: Partial<Action> = {}): Action {
  const now = new Date().toISOString();
  return {
    id: `a-${Math.random().toString(36).slice(2, 10)}`,
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

describe('ActionStore.supersede', () => {
  let dir: string;
  let store: ActionStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'action-store-test-'));
    store = new ActionStore({ dir });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('marks a pending action as EXPIRED with resolvedBy=superseded', async () => {
    const action = makeAction();
    await store.create(action);

    const result = await store.supersede(action.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe('EXPIRED');
    expect(result.data.resolvedBy).toBe('superseded');
    expect(result.data.resolvedAt).toBeDefined();
  });

  it('refuses to supersede an already-resolved action', async () => {
    const action = makeAction();
    await store.create(action);
    await store.approve(action.id);

    const result = await store.supersede(action.id);
    expect(result.success).toBe(false);
  });

  it('superseded actions no longer appear in getPending', async () => {
    const a = makeAction({ id: 'a-1', severity: 0.3 });
    const b = makeAction({ id: 'a-2', severity: 0.9 });
    await store.create(a);
    await store.create(b);

    await store.supersede('a-1');

    const pending = await store.getPending();
    expect(pending.map((p) => p.id)).toEqual(['a-2']);
  });

  it('persists the severity score on create/query roundtrip', async () => {
    await store.create(makeAction({ id: 'a-sev', severity: 0.72 }));
    const pending = await store.getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].severity).toBe(0.72);
  });
});

describe('ActionStore.dismiss', () => {
  let dir: string;
  let store: ActionStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'action-store-dismiss-'));
    store = new ActionStore({ dir });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('sets dismissedAt on a pending action', async () => {
    const action = makeAction();
    await store.create(action);
    const result = await store.dismiss(action.id);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dismissedAt).toBeDefined();
      expect(result.data.id).toBe(action.id);
    }
  });

  it('returns error for non-existent action', async () => {
    const result = await store.dismiss('non-existent-id');
    expect(result.success).toBe(false);
  });

  it('returns error for already dismissed action', async () => {
    const action = makeAction();
    await store.create(action);
    await store.dismiss(action.id);
    const result = await store.dismiss(action.id);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('already dismissed');
  });

  it('returns error for non-PENDING action', async () => {
    const action = makeAction();
    await store.create(action);
    await store.approve(action.id);
    const result = await store.dismiss(action.id);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('APPROVED');
  });

  it('auto-expires if action has passed expiresAt', async () => {
    const action = makeAction({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    await store.create(action);
    const result = await store.dismiss(action.id);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('expired');
  });

  it('dismissed actions are excluded from getPending', async () => {
    const action = makeAction();
    await store.create(action);
    await store.dismiss(action.id);
    const pending = await store.getPending();
    expect(pending).toHaveLength(0);
  });

  it('dismissed actions are excluded from query by default', async () => {
    const action = makeAction();
    await store.create(action);
    await store.dismiss(action.id);
    const results = await store.query({ status: 'PENDING' });
    expect(results).toHaveLength(0);
  });

  it('dismissed actions are included when dismissed=true', async () => {
    const action = makeAction();
    await store.create(action);
    await store.dismiss(action.id);
    const results = await store.query({ dismissed: true });
    expect(results).toHaveLength(1);
    expect(results[0].dismissedAt).toBeDefined();
  });

  it('query without dismissed filter excludes dismissed actions', async () => {
    const a1 = makeAction({ id: 'a-vis' });
    const a2 = makeAction({ id: 'a-dis' });
    await store.create(a1);
    await store.create(a2);
    await store.dismiss('a-dis');

    const results = await store.query({});
    const ids = results.map((r) => r.id);
    expect(ids).toContain('a-vis');
    expect(ids).not.toContain('a-dis');
  });
});
