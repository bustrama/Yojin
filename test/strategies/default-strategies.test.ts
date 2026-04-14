/**
 * Smoke test: every markdown file in data/default/strategies/ must parse into a valid
 * Strategy. These files are reference examples distributed via the public
 * trading-strategies repo — they must stay in sync with the current schema.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseFromMarkdown } from '../../src/strategies/strategy-serializer.js';

const DIR = join(process.cwd(), 'data/default/strategies');

describe('data/default/strategies markdown files', () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.md'));

  it('directory is non-empty', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`parses ${file}`, () => {
      const md = readFileSync(join(DIR, file), 'utf-8');
      const strategy = parseFromMarkdown(md);
      expect(strategy.name.length).toBeGreaterThan(0);
      expect(strategy.triggerGroups.length).toBeGreaterThan(0);
    });
  }
});
