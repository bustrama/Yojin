import { useMutation, useQuery } from 'urql';

import {
  ACTIONS_QUERY,
  ACTION_QUERY,
  APPROVE_ACTION_MUTATION,
  REJECT_ACTION_MUTATION,
  DISMISS_ACTION_MUTATION,
} from '../documents.js';
import type {
  ActionsQueryResult,
  ActionsQueryVariables,
  ActionQueryResult,
  ActionQueryVariables,
  ApproveActionMutationResult,
  ApproveActionVariables,
  RejectActionMutationResult,
  RejectActionVariables,
  DismissActionMutationResult,
  DismissActionVariables,
} from '../types.js';

/**
 * Fetch BUY/SELL/REVIEW Actions produced by Skill/Strategy triggers.
 *
 * Actions carry a PENDING → APPROVED | REJECTED | EXPIRED lifecycle. Defaults
 * to PENDING + not-dismissed — the items currently vying for the user's
 * attention. Uses `cache-and-network` so the UI paints from cache immediately.
 */
export function useActions(variables?: ActionsQueryVariables & { pause?: boolean }) {
  const { pause, ...rest } = variables ?? {};
  const queryVars: ActionsQueryVariables =
    Object.keys(rest).length > 0 ? rest : { status: 'PENDING', dismissed: false, limit: 50 };
  return useQuery<ActionsQueryResult, ActionsQueryVariables>({
    query: ACTIONS_QUERY,
    variables: queryVars,
    requestPolicy: 'cache-and-network',
    pause,
  });
}

export function useAction(id: string, pause = false) {
  return useQuery<ActionQueryResult, ActionQueryVariables>({
    query: ACTION_QUERY,
    variables: { id },
    requestPolicy: 'cache-and-network',
    pause,
  });
}

export function useApproveAction() {
  return useMutation<ApproveActionMutationResult, ApproveActionVariables>(APPROVE_ACTION_MUTATION);
}

export function useRejectAction() {
  return useMutation<RejectActionMutationResult, RejectActionVariables>(REJECT_ACTION_MUTATION);
}

export function useDismissAction() {
  return useMutation<DismissActionMutationResult, DismissActionVariables>(DISMISS_ACTION_MUTATION);
}
