import { describe, expect, it } from 'vitest';

import { createResearchAnalystProfile } from '../../src/agents/profiles/research-analyst.js';
import { createRiskManagerProfile } from '../../src/agents/profiles/risk-manager.js';
import { createStrategistProfile } from '../../src/agents/profiles/strategist.js';
import { createTraderProfile } from '../../src/agents/profiles/trader.js';
import { AgentProfileSchema } from '../../src/agents/types.js';

const DATA_ROOT = '.';

describe('Agent Profile Factories', () => {
  it('creates a valid research-analyst profile', async () => {
    const profile = await createResearchAnalystProfile(DATA_ROOT);
    expect(profile.id).toBe('research-analyst');
    expect(profile.tools.length).toBeGreaterThan(0);
    expect(profile.allowedActions).toContain('tool_call');
    expect(profile.systemPrompt).toContain('Research Analyst');
    AgentProfileSchema.parse(profile);
  });

  it('creates a valid strategist profile', async () => {
    const profile = await createStrategistProfile(DATA_ROOT);
    expect(profile.id).toBe('strategist');
    expect(profile.allowedActions).toContain('tool_call');
    expect(profile.systemPrompt).toContain('Strategist');
    AgentProfileSchema.parse(profile);
  });

  it('creates a valid risk-manager profile', async () => {
    const profile = await createRiskManagerProfile(DATA_ROOT);
    expect(profile.id).toBe('risk-manager');
    expect(profile.allowedActions).toContain('tool_call');
    expect(profile.systemPrompt).toContain('Risk Manager');
    AgentProfileSchema.parse(profile);
  });

  it('creates a valid trader profile', async () => {
    const profile = await createTraderProfile(DATA_ROOT);
    expect(profile.id).toBe('trader');
    expect(profile.allowedActions).toContain('tool_call');
    expect(profile.systemPrompt).toContain('Trader');
    AgentProfileSchema.parse(profile);
  });
});
