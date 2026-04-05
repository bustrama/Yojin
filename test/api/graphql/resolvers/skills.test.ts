import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  resolveCreateSkill,
  resolveDeleteSkill,
  resolveExportSkill,
  resolveImportSkill,
  resolveSkills,
  resolveUpdateSkill,
  setSkillStore,
} from '../../../../src/api/graphql/resolvers/skills.js';
import type { SkillStore } from '../../../../src/skills/skill-store.js';
import type { Skill } from '../../../../src/skills/types.js';

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

function createMockStore(skills: Skill[] = []): SkillStore {
  const map = new Map(skills.map((s) => [s.id, s]));
  return {
    getAll: vi.fn(() => [...map.values()]),
    getById: vi.fn((id: string) => map.get(id)),
    create: vi.fn((skill: Skill) => {
      if (map.has(skill.id)) throw new Error(`Skill already exists: ${skill.id}`);
      map.set(skill.id, skill);
    }),
    update: vi.fn((id: string, fields: Partial<Omit<Skill, 'id'>>) => {
      const existing = map.get(id);
      if (!existing) throw new Error(`Skill not found: ${id}`);
      const updated = { ...existing, ...fields, id };
      map.set(id, updated);
      return updated;
    }),
    delete: vi.fn((id: string) => {
      if (!map.has(id)) return false;
      map.delete(id);
      return true;
    }),
    setActive: vi.fn((id: string, active: boolean) => {
      const skill = map.get(id);
      if (!skill) return undefined;
      const updated = { ...skill, active };
      map.set(id, updated);
      return updated;
    }),
    save: vi.fn(),
    initialize: vi.fn(),
  } as unknown as SkillStore;
}

describe('skills resolvers', () => {
  let store: SkillStore;

  beforeEach(() => {
    store = createMockStore();
    setSkillStore(store);
  });

  describe('resolveCreateSkill', () => {
    it('creates a skill and returns it', () => {
      const result = resolveCreateSkill(null, {
        input: {
          name: 'Momentum Breakout',
          description: 'Buy on momentum breakout',
          category: 'MARKET',
          style: 'momentum',
          requires: ['MARKET_DATA', 'TECHNICALS'],
          content: '## Thesis\nBuy breakouts',
          triggers: [{ type: 'PRICE_MOVE', description: 'Price breaks above resistance' }],
          tickers: ['AAPL'],
        },
      });
      expect(store.create).toHaveBeenCalled();
      expect(result).toMatchObject({
        name: 'Momentum Breakout',
        style: 'momentum',
        requires: ['MARKET_DATA', 'TECHNICALS'],
      });
    });
  });

  describe('resolveUpdateSkill', () => {
    it('updates an existing skill', () => {
      const skill = makeSkill();
      store = createMockStore([skill]);
      setSkillStore(store);

      const result = resolveUpdateSkill(null, {
        id: 'test-skill',
        input: { description: 'Updated description', style: 'value' },
      });
      expect(store.update).toHaveBeenCalledWith(
        'test-skill',
        expect.objectContaining({ description: 'Updated description', style: 'value' }),
      );
      expect(result).toMatchObject({ id: 'test-skill', description: 'Updated description' });
    });

    it('throws for nonexistent skill', () => {
      expect(() => resolveUpdateSkill(null, { id: 'nope', input: { description: 'x' } })).toThrow('Skill not found');
    });
  });

  describe('resolveDeleteSkill', () => {
    it('deletes an existing skill', () => {
      const skill = makeSkill();
      store = createMockStore([skill]);
      setSkillStore(store);

      const result = resolveDeleteSkill(null, { id: 'test-skill' });
      expect(store.delete).toHaveBeenCalledWith('test-skill');
      expect(result).toBe(true);
    });

    it('throws for nonexistent skill', () => {
      expect(() => resolveDeleteSkill(null, { id: 'nope' })).toThrow('Skill not found');
    });
  });

  describe('resolveImportSkill', () => {
    it('imports from markdown string', () => {
      const md = `---
name: Imported Strategy
description: A strategy from markdown
category: MARKET
style: momentum
triggers:
  - type: PRICE_MOVE
    description: Price moves up
---

## Thesis
Buy the dip`;

      const result = resolveImportSkill(null, { markdown: md });
      expect(store.create).toHaveBeenCalled();
      expect(result).toMatchObject({ name: 'Imported Strategy' });
    });

    it('throws when neither markdown nor url provided', () => {
      expect(() => resolveImportSkill(null, {})).toThrow();
    });
  });

  describe('resolveExportSkill', () => {
    it('exports a skill as markdown', () => {
      const skill = makeSkill();
      store = createMockStore([skill]);
      setSkillStore(store);

      const result = resolveExportSkill(null, { id: 'test-skill' });
      expect(typeof result).toBe('string');
      expect(result).toContain('name: Test Skill');
      expect(result).toContain('## Thesis');
    });
  });

  describe('resolveSkills', () => {
    it('filters by style', () => {
      const skills = [
        makeSkill({ id: 'a', style: 'momentum' }),
        makeSkill({ id: 'b', style: 'value' }),
        makeSkill({ id: 'c', style: 'momentum' }),
      ];
      store = createMockStore(skills);
      setSkillStore(store);

      const result = resolveSkills(null, { style: 'momentum' }) as Array<{ id: string }>;
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.id)).toEqual(['a', 'c']);
    });

    it('filters by query string', () => {
      const skills = [
        makeSkill({ id: 'a', name: 'Momentum Breakout', description: 'Buy breakouts', content: '## Thesis\nBreakout' }),
        makeSkill({ id: 'b', name: 'Value Play', description: 'Find value', content: '## Thesis\nValue' }),
      ];
      store = createMockStore(skills);
      setSkillStore(store);

      const result = resolveSkills(null, { query: 'breakout' }) as Array<{ id: string }>;
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('a');
    });
  });
});
