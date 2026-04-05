/**
 * GraphQL resolvers for Skills — trading strategy management.
 */

import { DataCapabilitySchema } from '../../../skills/capabilities.js';
import type { DataCapability } from '../../../skills/capabilities.js';
import { parseFromMarkdown, serializeToMarkdown, slugify } from '../../../skills/skill-serializer.js';
import type { SkillStore } from '../../../skills/skill-store.js';
import type { Skill, SkillCategory } from '../../../skills/types.js';

// ---------------------------------------------------------------------------
// State — wired by composition root
// ---------------------------------------------------------------------------

let skillStore: SkillStore | null = null;

export function setSkillStore(store: SkillStore): void {
  skillStore = store;
}

// ---------------------------------------------------------------------------
// Capability mapping (domain snake_case ↔ GraphQL SCREAMING_SNAKE_CASE)
// Derived from DataCapabilitySchema to stay in sync automatically.
// ---------------------------------------------------------------------------

const CAPABILITY_TO_GQL: Record<string, string> = Object.fromEntries(
  DataCapabilitySchema.options.map((c) => [c, c.toUpperCase()]),
);

const GQL_TO_CAPABILITY: Record<string, DataCapability> = Object.fromEntries(
  DataCapabilitySchema.options.map((c) => [c.toUpperCase(), c]),
);

// ---------------------------------------------------------------------------
// Query resolvers
// ---------------------------------------------------------------------------

export function resolveSkills(
  _: unknown,
  args: { category?: SkillCategory; active?: boolean; style?: string; query?: string },
): unknown[] {
  if (!skillStore) return [];
  let skills = skillStore.getAll();
  if (args.category) {
    skills = skills.filter((s) => s.category === args.category);
  }
  if (args.active !== undefined) {
    skills = skills.filter((s) => s.active === args.active);
  }
  if (args.style) {
    skills = skills.filter((s) => s.style === args.style);
  }
  if (args.query) {
    const q = args.query.toLowerCase();
    skills = skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.content.toLowerCase().includes(q),
    );
  }
  return skills.map(toGraphQL);
}

export function resolveSkill(_: unknown, args: { id: string }): unknown | null {
  if (!skillStore) return null;
  const skill = skillStore.getById(args.id);
  return skill ? toGraphQL(skill) : null;
}

export function resolveExportSkill(_: unknown, args: { id: string }): string {
  if (!skillStore) throw new Error('Skill store not initialized');
  const skill = skillStore.getById(args.id);
  if (!skill) throw new Error(`Skill not found: ${args.id}`);
  return serializeToMarkdown(skill);
}

// ---------------------------------------------------------------------------
// Mutation resolvers
// ---------------------------------------------------------------------------

export function resolveToggleSkill(_: unknown, args: { id: string; active: boolean }): unknown {
  if (!skillStore) throw new Error('Skill store not initialized');
  const updated = skillStore.setActive(args.id, args.active);
  if (!updated) throw new Error(`Skill not found: ${args.id}`);
  return toGraphQL(updated);
}

interface SkillTriggerInput {
  type: string;
  description: string;
  params?: string;
}

interface CreateSkillInput {
  name: string;
  description: string;
  category: SkillCategory;
  style: string;
  requires?: string[];
  content: string;
  triggers: SkillTriggerInput[];
  tickers?: string[];
  maxPositionSize?: number;
}

interface UpdateSkillInput {
  name?: string;
  description?: string;
  category?: SkillCategory;
  style?: string;
  requires?: string[];
  content?: string;
  triggers?: SkillTriggerInput[];
  tickers?: string[];
  maxPositionSize?: number;
}

function mapTriggersFromInput(triggers: SkillTriggerInput[]): Skill['triggers'] {
  return triggers.map((t, i) => {
    let params: Record<string, unknown> | undefined;
    if (t.params) {
      try {
        params = JSON.parse(t.params) as Record<string, unknown>;
      } catch {
        throw new Error(`Trigger ${i + 1}: invalid JSON in params`);
      }
    }
    return {
      type: t.type as Skill['triggers'][number]['type'],
      description: t.description,
      ...(params ? { params } : {}),
    };
  });
}

function mapRequiresFromInput(requires?: string[]): DataCapability[] {
  if (!requires) return [];
  return requires.map((r) => GQL_TO_CAPABILITY[r] ?? (r.toLowerCase() as DataCapability));
}

export function resolveCreateSkill(_: unknown, args: { input: CreateSkillInput }): unknown {
  if (!skillStore) throw new Error('Skill store not initialized');
  const { input } = args;
  let id = slugify(input.name);
  const existing = skillStore.getById(id);
  if (existing) {
    id = `${id}-${Date.now()}`;
  }
  const skill: Skill = {
    id,
    name: input.name,
    description: input.description,
    category: input.category,
    style: input.style,
    requires: mapRequiresFromInput(input.requires),
    active: false,
    source: 'custom',
    createdBy: 'user',
    createdAt: new Date().toISOString(),
    content: input.content,
    triggers: mapTriggersFromInput(input.triggers),
    tickers: input.tickers ?? [],
    ...(input.maxPositionSize !== undefined ? { maxPositionSize: input.maxPositionSize } : {}),
  };
  skillStore.create(skill);
  return toGraphQL(skill);
}

export function resolveUpdateSkill(_: unknown, args: { id: string; input: UpdateSkillInput }): unknown {
  if (!skillStore) throw new Error('Skill store not initialized');
  const { id, input } = args;
  const fields: Partial<Omit<Skill, 'id'>> = {};
  if (input.name !== undefined) fields.name = input.name;
  if (input.description !== undefined) fields.description = input.description;
  if (input.category !== undefined) fields.category = input.category;
  if (input.style !== undefined) fields.style = input.style;
  if (input.requires !== undefined) fields.requires = mapRequiresFromInput(input.requires);
  if (input.content !== undefined) fields.content = input.content;
  if (input.triggers !== undefined) fields.triggers = mapTriggersFromInput(input.triggers);
  if (input.tickers !== undefined) fields.tickers = input.tickers;
  if (input.maxPositionSize !== undefined) fields.maxPositionSize = input.maxPositionSize;
  const updated = skillStore.update(id, fields);
  return toGraphQL(updated);
}

export function resolveDeleteSkill(_: unknown, args: { id: string }): boolean {
  if (!skillStore) throw new Error('Skill store not initialized');
  const deleted = skillStore.delete(args.id);
  if (!deleted) throw new Error(`Skill not found: ${args.id}`);
  return true;
}

export function resolveImportSkill(_: unknown, args: { markdown: string }): unknown {
  if (!skillStore) throw new Error('Skill store not initialized');
  const skill = parseFromMarkdown(args.markdown);
  if (skillStore.getById(skill.id)) {
    skill.id = `${skill.id}-${Date.now()}`;
  }
  skillStore.create(skill);
  return toGraphQL(skill);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toGraphQL(skill: Skill): unknown {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    category: skill.category,
    style: skill.style,
    requires: skill.requires.map((r) => CAPABILITY_TO_GQL[r] ?? r.toUpperCase()),
    active: skill.active,
    source: skill.source,
    createdBy: skill.createdBy,
    createdAt: skill.createdAt,
    content: skill.content,
    triggers: skill.triggers.map((t) => ({
      type: t.type,
      description: t.description,
      params: t.params ? JSON.stringify(t.params) : null,
    })),
    maxPositionSize: skill.maxPositionSize ?? null,
    tickers: skill.tickers,
  };
}
