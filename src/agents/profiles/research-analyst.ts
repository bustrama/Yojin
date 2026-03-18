import { loadAgentPrompt } from '../../brain/persona.js';
import type { AgentProfile } from '../types.js';

export async function createResearchAnalystProfile(dataRoot = '.'): Promise<AgentProfile> {
  const systemPrompt = await loadAgentPrompt('research-analyst', dataRoot);

  return {
    id: 'research-analyst',
    name: 'Research Analyst',
    description: 'Market intelligence — gathers, validates, and structures data from connected sources.',
    systemPrompt,
    tools: [
      'equityGetProfile',
      'equityGetFinancials',
      'equityGetRatios',
      'equityGetEstimates',
      'equityGetEarningsCalendar',
      'equityGetInsiderTrading',
      'equityGetInstitutional',
      'equityGetMovers',
      'globNews',
      'grepNews',
      'readNews',
      'newsGetCompany',
      'newsGetWorld',
      'marketSearch',
      'calculateIndicator',
      'enrichPosition',
      'enrichPortfolio',
    ],
    allowedActions: ['tool_call', 'network_request'],
  };
}
