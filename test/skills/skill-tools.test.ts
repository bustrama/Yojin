import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ToolDefinition } from '../../src/core/types.js';
import { SkillEvaluator } from '../../src/skills/skill-evaluator.js';
import { SkillStore } from '../../src/skills/skill-store.js';
import { createSkillTools } from '../../src/skills/skill-tools.js';
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

describe('createSkillTools', () => {
  let dir: string;
  let skillStore: SkillStore;
  let skillEvaluator: SkillEvaluator;
  let tools: ToolDefinition[];

  function getTool(name: string): ToolDefinition {
    const tool = tools.find((t) => t.name === name);
    if (!tool) throw new Error(`Tool not found: ${name}`);
    return tool;
  }

  beforeEach(() => {
    dir = join(tmpdir(), `yojin-skill-tools-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    skillStore = new SkillStore({ dir });
    skillEvaluator = new SkillEvaluator(skillStore);
    tools = createSkillTools({ skillStore, skillEvaluator });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns 5 tools', () => {
    expect(tools).toHaveLength(5);
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(['activate_skill', 'deactivate_skill', 'get_skill', 'get_skill_evaluations', 'list_skills']);
  });

  describe('list_skills', () => {
    it('returns empty list when no skills exist', async () => {
      const result = await getTool('list_skills').execute({});
      expect(result.content).toContain('No skills');
    });

    it('lists skills with capability status', async () => {
      skillStore.create(makeSkill());
      skillStore.create(makeSkill({ id: 'skill-2', name: 'Second Skill', style: 'value', active: true }));

      const result = await getTool('list_skills').execute({});
      expect(result.content).toContain('Test Skill');
      expect(result.content).toContain('Second Skill');
      expect(result.content).toContain('executable');
    });

    it('filters by query', async () => {
      skillStore.create(makeSkill({ id: 'alpha', name: 'Alpha Strategy' }));
      skillStore.create(makeSkill({ id: 'beta', name: 'Beta Hedge' }));

      const result = await getTool('list_skills').execute({ query: 'Alpha' });
      expect(result.content).toContain('Alpha Strategy');
      expect(result.content).not.toContain('Beta Hedge');
    });

    it('filters by active status', async () => {
      skillStore.create(makeSkill({ id: 'active-one', name: 'Active One', active: true }));
      skillStore.create(makeSkill({ id: 'inactive-one', name: 'Inactive One', active: false }));

      const result = await getTool('list_skills').execute({ active: true });
      expect(result.content).toContain('Active One');
      expect(result.content).not.toContain('Inactive One');
    });

    it('filters by category', async () => {
      skillStore.create(makeSkill({ id: 'risk-skill', name: 'Risk Skill', category: 'RISK' }));
      skillStore.create(makeSkill({ id: 'market-skill', name: 'Market Skill', category: 'MARKET' }));

      const result = await getTool('list_skills').execute({ category: 'RISK' });
      expect(result.content).toContain('Risk Skill');
      expect(result.content).not.toContain('Market Skill');
    });

    it('filters by style', async () => {
      skillStore.create(makeSkill({ id: 'mom', name: 'Momentum Play', style: 'momentum' }));
      skillStore.create(makeSkill({ id: 'val', name: 'Value Play', style: 'value' }));

      const result = await getTool('list_skills').execute({ style: 'value' });
      expect(result.content).toContain('Value Play');
      expect(result.content).not.toContain('Momentum Play');
    });
  });

  describe('get_skill', () => {
    it('returns full skill details with capability check', async () => {
      skillStore.create(makeSkill());

      const result = await getTool('get_skill').execute({ id: 'test-skill' });
      expect(result.content).toContain('Test Skill');
      expect(result.content).toContain('PRICE_MOVE');
      expect(result.content).toContain('executable');
      expect(result.content).toContain('## Thesis');
    });

    it('returns error for nonexistent skill', async () => {
      const result = await getTool('get_skill').execute({ id: 'nonexistent' });
      expect(result.isError).toBe(true);
      expect(result.content).toContain('not found');
    });
  });

  describe('activate_skill', () => {
    it('activates a skill', async () => {
      skillStore.create(makeSkill());

      const result = await getTool('activate_skill').execute({ id: 'test-skill' });
      expect(result.content).toContain('activated');
      expect(skillStore.getById('test-skill')!.active).toBe(true);
    });

    it('warns about missing capabilities', async () => {
      skillStore.create(makeSkill({ requires: ['derivatives'] }));

      const result = await getTool('activate_skill').execute({ id: 'test-skill' });
      expect(result.content).toContain('activated');
      expect(result.content).toMatch(/missing|limited/i);
      expect(result.content).toContain('derivatives');
    });

    it('returns error for nonexistent skill', async () => {
      const result = await getTool('activate_skill').execute({ id: 'nonexistent' });
      expect(result.isError).toBe(true);
    });
  });

  describe('deactivate_skill', () => {
    it('deactivates a skill', async () => {
      skillStore.create(makeSkill({ active: true }));

      const result = await getTool('deactivate_skill').execute({ id: 'test-skill' });
      expect(result.content).toContain('deactivated');
      expect(skillStore.getById('test-skill')!.active).toBe(false);
    });

    it('returns error for nonexistent skill', async () => {
      const result = await getTool('deactivate_skill').execute({ id: 'nonexistent' });
      expect(result.isError).toBe(true);
    });
  });

  describe('get_skill_evaluations', () => {
    it('returns evaluations for active skills', async () => {
      skillStore.create(
        makeSkill({
          active: true,
          tickers: ['AAPL'],
          triggers: [{ type: 'PRICE_MOVE', description: 'Drop >10%', params: { threshold: -0.1 } }],
        }),
      );

      const result = await getTool('get_skill_evaluations').execute({});
      // With empty portfolio context, no triggers fire
      expect(result.content).toContain('No skill triggers fired');
    });

    it('returns message when no active skills', async () => {
      skillStore.create(makeSkill({ active: false }));

      const result = await getTool('get_skill_evaluations').execute({});
      expect(result.content).toContain('No active skills');
    });
  });
});
