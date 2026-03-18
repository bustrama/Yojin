import type { AgentProfile } from '../types.js';

export function createResearchAnalystProfile(): AgentProfile {
  return {
    id: 'research-analyst',
    name: 'Research Analyst',
    role: 'analyst',
    description: 'Market intelligence — gathers, validates, and structures data from connected sources.',
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
    capabilities: ['market-data', 'technicals', 'news', 'enrichment', 'symbol-resolution'],
  };
}
