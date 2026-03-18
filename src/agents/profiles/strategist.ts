import type { AgentProfile } from '../types.js';

export function createStrategistProfile(): AgentProfile {
  return {
    id: 'strategist',
    name: 'Strategist',
    role: 'strategist',
    description: 'Decision-maker — synthesizes research, risk, and persona into recommendations.',
    tools: [
      'getFrontalLobe',
      'updateFrontalLobe',
      'getEmotion',
      'updateEmotion',
      'getPersona',
      'getEnrichedSnapshot',
      'getResearchSummary',
      'getRiskReport',
      'getSectorExposure',
      'getConcentration',
    ],
    allowedActions: ['tool_call'],
    capabilities: ['reasoning', 'memory', 'emotion', 'persona', 'recommendations'],
  };
}
