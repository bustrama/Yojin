import { loadAgentPrompt } from '../../brain/persona.js';
import type { AgentProfile } from '../types.js';

export async function createRiskManagerProfile(dataRoot = '.'): Promise<AgentProfile> {
  const systemPrompt = await loadAgentPrompt('risk-manager', dataRoot);

  return {
    id: 'risk-manager',
    name: 'Risk Manager',
    description: 'Portfolio risk analysis — exposure, concentration, correlation, earnings proximity.',
    systemPrompt,
    tools: [
      'analyzeExposure',
      'getConcentrationScore',
      'detectCorrelations',
      'getEarningsCalendar',
      'getDrawdown',
      'generateRiskReport',
    ],
    allowedActions: ['tool_call'],
  };
}
