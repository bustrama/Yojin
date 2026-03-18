import { describe, expect, it } from 'vitest';

import { type AgentId, AgentIdSchema, type AgentProfile, AgentProfileSchema } from '../../src/agents/types.js';

describe('AgentIdSchema', () => {
  it('accepts valid agent IDs', () => {
    const ids: AgentId[] = ['research-analyst', 'strategist', 'risk-manager', 'trader'];
    for (const id of ids) {
      expect(AgentIdSchema.parse(id)).toBe(id);
    }
  });

  it('rejects invalid agent ID', () => {
    expect(() => AgentIdSchema.parse('unknown-agent')).toThrow();
  });
});

describe('AgentProfileSchema', () => {
  it('validates a complete profile', () => {
    const profile: AgentProfile = {
      id: 'research-analyst',
      name: 'Research Analyst',
      description: 'Market intelligence agent',
      systemPrompt: '# Research Analyst\nYou are...',
      tools: ['equityGetProfile', 'equityGetFinancials'],
      allowedActions: ['tool_call', 'network_request'],
    };
    expect(AgentProfileSchema.parse(profile)).toEqual(profile);
  });

  it('accepts optional provider and model overrides', () => {
    const profile: AgentProfile = {
      id: 'strategist',
      name: 'Strategist',
      description: 'Decision-maker',
      systemPrompt: '# Strategist',
      tools: [],
      allowedActions: ['tool_call'],
      provider: 'vercel-ai',
      model: 'gpt-4o',
    };
    expect(AgentProfileSchema.parse(profile)).toEqual(profile);
  });
});
