import { loadAgentPrompt } from '../brain/persona.js';
import { createResearchAnalystProfile } from './profiles/research-analyst.js';
import { createRiskManagerProfile } from './profiles/risk-manager.js';
import { createStrategistProfile } from './profiles/strategist.js';
import { createTraderProfile } from './profiles/trader.js';
import type { AgentId, AgentProfile } from './types.js';

export class AgentRegistry {
  private profiles = new Map<AgentId, AgentProfile>();
  private readonly dataRoot: string;

  constructor(dataRoot = '.') {
    this.dataRoot = dataRoot;
  }

  register(profile: AgentProfile): void {
    if (this.profiles.has(profile.id)) {
      throw new Error(`Agent profile already registered: ${profile.id}`);
    }
    this.profiles.set(profile.id, profile);
  }

  get(id: AgentId): AgentProfile | undefined {
    return this.profiles.get(id);
  }

  all(): AgentProfile[] {
    return [...this.profiles.values()];
  }

  async reloadPrompt(id: AgentId): Promise<void> {
    const profile = this.profiles.get(id);
    if (!profile) throw new Error(`Agent not registered: ${id}`);
    profile.systemPrompt = await loadAgentPrompt(id, this.dataRoot);
  }

  async loadAll(): Promise<void> {
    const factories = [
      createResearchAnalystProfile,
      createStrategistProfile,
      createRiskManagerProfile,
      createTraderProfile,
    ];

    for (const factory of factories) {
      const profile = await factory(this.dataRoot);
      this.profiles.set(profile.id, profile);
    }
  }
}
