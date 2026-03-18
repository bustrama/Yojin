import { beforeEach, describe, expect, it } from 'vitest';

import { AgentRegistry } from '../../src/agents/registry.js';
import type { AgentId, AgentProfile } from '../../src/agents/types.js';

const DATA_ROOT = '.';

function stubProfile(id: AgentId): AgentProfile {
  return {
    id,
    name: id,
    description: `${id} agent`,
    systemPrompt: `# ${id}`,
    tools: ['tool_a'],
    allowedActions: ['tool_call'],
  };
}

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry(DATA_ROOT);
  });

  it('registers and retrieves a profile', () => {
    const profile = stubProfile('strategist');
    registry.register(profile);
    expect(registry.get('strategist')).toEqual(profile);
  });

  it('returns undefined for unregistered ID', () => {
    expect(registry.get('strategist')).toBeUndefined();
  });

  it('lists all registered profiles', () => {
    registry.register(stubProfile('strategist'));
    registry.register(stubProfile('trader'));
    expect(registry.all()).toHaveLength(2);
  });

  it('throws on duplicate registration', () => {
    registry.register(stubProfile('strategist'));
    expect(() => registry.register(stubProfile('strategist'))).toThrow();
  });

  it('loadAll registers all 4 profiles', async () => {
    await registry.loadAll();
    expect(registry.all()).toHaveLength(4);
    expect(registry.get('research-analyst')).toBeDefined();
    expect(registry.get('strategist')).toBeDefined();
    expect(registry.get('risk-manager')).toBeDefined();
    expect(registry.get('trader')).toBeDefined();
  });

  it('reloadPrompt updates system prompt from disk', async () => {
    await registry.loadAll();
    const before = registry.get('strategist')!.systemPrompt;
    await registry.reloadPrompt('strategist');
    const after = registry.get('strategist')!.systemPrompt;
    expect(after).toBe(before);
  });
});
