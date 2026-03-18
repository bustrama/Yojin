import type { AgentProfile } from '../types.js';

export function createRiskManagerProfile(): AgentProfile {
  return {
    id: 'risk-manager',
    name: 'Risk Manager',
    role: 'risk-manager',
    description: 'Portfolio risk analysis — exposure, concentration, correlation, earnings proximity.',
    tools: [
      'analyzeExposure',
      'getConcentrationScore',
      'detectCorrelations',
      'getEarningsCalendar',
      'getDrawdown',
      'generateRiskReport',
    ],
    allowedActions: ['tool_call'],
    capabilities: ['exposure-analysis', 'concentration', 'correlation', 'earnings', 'drawdown'],
  };
}
