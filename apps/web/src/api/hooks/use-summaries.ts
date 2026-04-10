import { useMutation, useQuery } from 'urql';

import { APPROVE_SUMMARY_MUTATION, REJECT_SUMMARY_MUTATION, SUMMARIES_QUERY } from '../documents.js';
import type {
  ApproveSummaryMutationResult,
  ApproveSummaryVariables,
  RejectSummaryMutationResult,
  RejectSummaryVariables,
  SummariesQueryResult,
  SummariesQueryVariables,
} from '../types.js';

/**
 * Fetch summaries (severity-ranked TLDR of the signal pipeline).
 *
 * Defaults to PENDING only — these are the items currently vying for the
 * user's attention. Uses `cache-and-network` so the UI paints from cache
 * immediately, then reconciles against the server on each poll cycle.
 */
export function useSummaries(variables?: SummariesQueryVariables & { pause?: boolean }) {
  const { pause, ...rest } = variables ?? {};
  const queryVars: SummariesQueryVariables =
    Object.keys(rest).length > 0 ? (rest as SummariesQueryVariables) : { status: 'PENDING', limit: 50 };
  return useQuery<SummariesQueryResult, SummariesQueryVariables>({
    query: SUMMARIES_QUERY,
    variables: queryVars,
    requestPolicy: 'cache-and-network',
    pause,
  });
}

export function useApproveSummary() {
  return useMutation<ApproveSummaryMutationResult, ApproveSummaryVariables>(APPROVE_SUMMARY_MUTATION);
}

export function useRejectSummary() {
  return useMutation<RejectSummaryMutationResult, RejectSummaryVariables>(REJECT_SUMMARY_MUTATION);
}
