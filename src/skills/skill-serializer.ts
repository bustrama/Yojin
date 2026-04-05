import * as yaml from 'yaml';
import { z } from 'zod';

import { DataCapabilitySchema } from './capabilities.js';
import { SkillCategorySchema, SkillSchema, SkillTriggerSchema } from './types.js';
import type { Skill } from './types.js';

const FrontmatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  category: SkillCategorySchema,
  style: z.string().min(1),
  requires: z.array(DataCapabilitySchema).default([]),
  triggers: z.array(SkillTriggerSchema).min(1),
  tickers: z.array(z.string()).default([]),
  maxPositionSize: z.number().min(0).max(1).optional(),
});

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function parseFromMarkdown(md: string): Skill {
  const match = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    throw new Error('Invalid markdown: missing YAML frontmatter delimiters (---)');
  }

  const [, yamlStr, body] = match;
  let rawYaml: unknown;
  try {
    rawYaml = yaml.parse(yamlStr);
  } catch (err) {
    throw new Error(`Invalid YAML frontmatter: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
  }

  const frontmatter = FrontmatterSchema.parse(rawYaml);
  const content = body.trim();

  if (!content) {
    throw new Error('Markdown body (strategy content) cannot be empty');
  }

  const skill: Skill = SkillSchema.parse({
    id: slugify(frontmatter.name),
    name: frontmatter.name,
    description: frontmatter.description,
    category: frontmatter.category,
    style: frontmatter.style,
    requires: frontmatter.requires,
    active: false,
    source: 'community',
    createdBy: 'community',
    createdAt: new Date().toISOString(),
    content,
    triggers: frontmatter.triggers,
    maxPositionSize: frontmatter.maxPositionSize,
    tickers: frontmatter.tickers,
  });

  return skill;
}

export function serializeToMarkdown(skill: Skill): string {
  const frontmatter: Record<string, unknown> = {
    name: skill.name,
    description: skill.description,
    category: skill.category,
    style: skill.style,
  };

  if (skill.requires.length > 0) {
    frontmatter['requires'] = skill.requires;
  }

  frontmatter['triggers'] = skill.triggers.map((t) => ({
    type: t.type,
    description: t.description,
    ...(t.params ? { params: t.params } : {}),
  }));

  frontmatter['tickers'] = skill.tickers;

  if (skill.maxPositionSize !== undefined) {
    frontmatter['maxPositionSize'] = skill.maxPositionSize;
  }

  const yamlStr = yaml.stringify(frontmatter, { lineWidth: 0 });
  return `---\n${yamlStr}---\n\n${skill.content}\n`;
}
