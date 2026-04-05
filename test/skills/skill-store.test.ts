import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SkillStore } from '../../src/skills/skill-store.js';
import type { Skill } from '../../src/skills/types.js';

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'test-skill',
    name: 'Test Skill',
    description: 'A test skill',
    category: 'MARKET',
    style: 'momentum',
    requires: ['market_data'],
    active: false,
    source: 'custom',
    createdBy: 'test',
    createdAt: '2026-01-01T00:00:00.000Z',
    content: '## Thesis\nTest content',
    triggers: [{ type: 'PRICE_MOVE', description: 'Test trigger' }],
    tickers: [],
    ...overrides,
  };
}

describe('SkillStore', () => {
  let dir: string;
  let store: SkillStore;

  beforeEach(() => {
    dir = join(tmpdir(), `yojin-skill-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    store = new SkillStore({ dir });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  describe('create', () => {
    it('creates a new skill', () => {
      const skill = makeSkill();
      store.create(skill);
      expect(store.getById('test-skill')).toBeDefined();
      expect(store.getById('test-skill')!.name).toBe('Test Skill');
    });

    it('throws if skill id already exists', () => {
      const skill = makeSkill();
      store.create(skill);
      expect(() => store.create(skill)).toThrow(/already exists/);
    });

    it('persists to disk', () => {
      store.create(makeSkill());
      expect(existsSync(join(dir, 'test-skill.json'))).toBe(true);
    });
  });

  describe('update', () => {
    it('updates an existing skill', () => {
      store.create(makeSkill());
      store.update('test-skill', { name: 'Updated Name', description: 'Updated desc' });
      expect(store.getById('test-skill')!.name).toBe('Updated Name');
    });

    it('throws if skill does not exist', () => {
      expect(() => store.update('nonexistent', { name: 'Nope' })).toThrow(/not found/);
    });

    it('preserves fields not in the update', () => {
      store.create(makeSkill());
      store.update('test-skill', { name: 'New Name' });
      const updated = store.getById('test-skill')!;
      expect(updated.category).toBe('MARKET');
      expect(updated.content).toBe('## Thesis\nTest content');
    });
  });

  describe('initialize + round-trip', () => {
    it('loads created skills from disk', async () => {
      store.create(makeSkill());
      const store2 = new SkillStore({ dir });
      await store2.initialize();
      expect(store2.getById('test-skill')).toBeDefined();
    });
  });
});
