import type { AgentProfile } from '../types.js';

export function createTraderProfile(): AgentProfile {
  return {
    id: 'trader',
    name: 'Trader',
    role: 'trader',
    description: 'Execution — scrapes platforms, tracks positions, executes approved trades.',
    tools: [
      'loginPlatform',
      'logoutPlatform',
      'scrapePositions',
      'refreshPositions',
      'getPortfolio',
      'getPositionHistory',
    ],
    allowedActions: ['tool_call', 'trade'],
    capabilities: ['platform-connection', 'position-fetching', 'trade-execution'],
  };
}
