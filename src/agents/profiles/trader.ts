import { loadAgentPrompt } from '../../brain/persona.js';
import type { AgentProfile } from '../types.js';

export async function createTraderProfile(dataRoot = '.'): Promise<AgentProfile> {
  const systemPrompt = await loadAgentPrompt('trader', dataRoot);

  return {
    id: 'trader',
    name: 'Trader',
    description: 'Execution — scrapes platforms, tracks positions, executes approved trades.',
    systemPrompt,
    tools: [
      'loginPlatform',
      'logoutPlatform',
      'scrapePositions',
      'refreshPositions',
      'getPortfolio',
      'getPositionHistory',
    ],
    allowedActions: ['tool_call', 'trade'],
  };
}
