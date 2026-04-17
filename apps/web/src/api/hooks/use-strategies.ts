import { useCallback } from 'react';
import { useClient, useQuery, useMutation } from 'urql';

import {
  STRATEGIES_QUERY,
  STRATEGY_QUERY,
  EXPORT_STRATEGY_QUERY,
  SUGGEST_TICKERS_FOR_STRATEGY_QUERY,
  TOGGLE_STRATEGY_MUTATION,
  CREATE_STRATEGY_MUTATION,
  UPDATE_STRATEGY_MUTATION,
  DELETE_STRATEGY_MUTATION,
  IMPORT_STRATEGY_MUTATION,
  STRATEGY_SOURCES_QUERY,
  ADD_STRATEGY_SOURCE_MUTATION,
  REMOVE_STRATEGY_SOURCE_MUTATION,
  TOGGLE_STRATEGY_SOURCE_MUTATION,
  SYNC_STRATEGIES_MUTATION,
} from '../documents.js';
import type {
  StrategiesQueryResult,
  StrategiesQueryVariables,
  StrategyQueryResult,
  ExportStrategyQueryResult,
  SuggestTickersForStrategyResult,
  SuggestTickersForStrategyVariables,
  ToggleStrategyMutationResult,
  CreateStrategyMutationResult,
  UpdateStrategyMutationResult,
  DeleteStrategyMutationResult,
  ImportStrategyMutationResult,
  ImportStrategyVariables,
  StrategySourcesQueryResult,
  AddStrategySourceResult,
  AddStrategySourceVariables,
  RemoveStrategySourceResult,
  ToggleStrategySourceResult,
  SyncStrategiesResult,
} from '../types.js';

export function useStrategies(variables?: StrategiesQueryVariables) {
  return useQuery<StrategiesQueryResult, StrategiesQueryVariables>({ query: STRATEGIES_QUERY, variables });
}

export function useStrategy(id: string) {
  return useQuery<StrategyQueryResult>({ query: STRATEGY_QUERY, variables: { id }, pause: !id });
}

export function useExportStrategy() {
  const client = useClient();
  const exportStrategy = useCallback(
    (variables: { id: string }) =>
      client.query<ExportStrategyQueryResult>(EXPORT_STRATEGY_QUERY, variables).toPromise(),
    [client],
  );
  return exportStrategy;
}

export function useSuggestTickersForStrategy() {
  const client = useClient();
  return useCallback(
    (variables: SuggestTickersForStrategyVariables) =>
      client
        .query<
          SuggestTickersForStrategyResult,
          SuggestTickersForStrategyVariables
        >(SUGGEST_TICKERS_FOR_STRATEGY_QUERY, variables, { requestPolicy: 'network-only' })
        .toPromise(),
    [client],
  );
}

export function useToggleStrategy() {
  return useMutation<ToggleStrategyMutationResult>(TOGGLE_STRATEGY_MUTATION);
}

export function useCreateStrategy() {
  return useMutation<CreateStrategyMutationResult>(CREATE_STRATEGY_MUTATION);
}

export function useUpdateStrategy() {
  return useMutation<UpdateStrategyMutationResult>(UPDATE_STRATEGY_MUTATION);
}

export function useDeleteStrategy() {
  return useMutation<DeleteStrategyMutationResult>(DELETE_STRATEGY_MUTATION);
}

export function useImportStrategy() {
  return useMutation<ImportStrategyMutationResult, ImportStrategyVariables>(IMPORT_STRATEGY_MUTATION);
}

export function useStrategySources() {
  return useQuery<StrategySourcesQueryResult>({ query: STRATEGY_SOURCES_QUERY });
}

export function useAddStrategySource() {
  return useMutation<AddStrategySourceResult, AddStrategySourceVariables>(ADD_STRATEGY_SOURCE_MUTATION);
}

export function useRemoveStrategySource() {
  return useMutation<RemoveStrategySourceResult, { id: string }>(REMOVE_STRATEGY_SOURCE_MUTATION);
}

export function useToggleStrategySource() {
  return useMutation<ToggleStrategySourceResult, { id: string; enabled: boolean }>(TOGGLE_STRATEGY_SOURCE_MUTATION);
}

export function useSyncStrategies() {
  return useMutation<SyncStrategiesResult>(SYNC_STRATEGIES_MUTATION);
}
