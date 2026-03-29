import { useQuery } from 'urql';
import { ONBOARDING_STATUS_QUERY } from '../api/documents';
import type { OnboardingStatusQueryResult } from '../api/types';

/**
 * Reactive feature-readiness flags derived from the backend onboarding status.
 * urql's cacheExchange deduplicates the underlying query across all consumers.
 */
export function useFeatureStatus() {
  const [result] = useQuery<OnboardingStatusQueryResult>({
    query: ONBOARDING_STATUS_QUERY,
    requestPolicy: 'cache-and-network',
  });

  return {
    jintelConfigured: result.data?.onboardingStatus?.jintelConfigured ?? false,
    aiConfigured: result.data?.onboardingStatus?.aiCredentialConfigured ?? false,
    loading: result.fetching,
  };
}
