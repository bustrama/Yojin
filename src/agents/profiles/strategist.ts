import { loadAgentPrompt } from '../../brain/persona.js';
import type { AgentProfile } from '../types.js';

export async function createStrategistProfile(dataRoot = '.'): Promise<AgentProfile> {
  const systemPrompt = await loadAgentPrompt('strategist', dataRoot);

  return {
    id: 'strategist',
    name: 'Strategist',
    description: 'Decision-maker — synthesizes research, risk, and persona into recommendations.',
    systemPrompt,
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
  };
}
