import { useQuery } from 'urql';

import { SUMMARIES_QUERY, SUMMARY_QUERY } from '../documents.js';
import type {
  SummariesQueryResult,
  SummariesQueryVariables,
  SummaryQueryResult,
  SummaryQueryVariables,
} from '../types.js';

/**
 * Fetch neutral intel summaries from the macro + micro insight pipelines.
 *
 * Summaries are read-only observations — they have no approval lifecycle.
 * The opinionated BUY/SELL layer lives in the `Action` type, reachable via
 * `useActions`.
 *
 * Uses `cache-and-network` so the UI paints from cache immediately, then
 * reconciles against the server on each poll cycle.
 */
export function useSummaries(variables?: SummariesQueryVariables & { pause?: boolean }) {
  const { pause, ...rest } = variables ?? {};
  const queryVars: SummariesQueryVariables = Object.keys(rest).length > 0 ? rest : { limit: 50 };
  return useQuery<SummariesQueryResult, SummariesQueryVariables>({
    query: SUMMARIES_QUERY,
    variables: queryVars,
    requestPolicy: 'cache-and-network',
    pause,
  });
}

export function useSummary(id: string, pause = false) {
  return useQuery<SummaryQueryResult, SummaryQueryVariables>({
    query: SUMMARY_QUERY,
    variables: { id },
    requestPolicy: 'cache-and-network',
    pause,
  });
}
