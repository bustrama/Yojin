import { useCallback, useState } from 'react';
import { useMutation, useQuery } from 'urql';

import Card from '../components/common/card';
import Spinner from '../components/common/spinner';
import Button from '../components/common/button';
import Badge from '../components/common/badge';
import { JintelKeyForm } from '../components/jintel/jintel-key-form';
import { ONBOARDING_STATUS_QUERY, RESET_ONBOARDING_MUTATION } from '../api/documents';
import type { OnboardingStatusQueryResult } from '../api/types';
import { DataSourceCard } from '../components/data-sources/data-source-card';
import { AddDataSourceModal } from '../components/data-sources/add-data-source-modal';
import {
  useListDataSources,
  useRemoveDataSource,
  useToggleDataSource,
  useFetchDataSource,
  useClearAppData,
} from '../api/hooks';
import { useOnboardingStatus } from '../lib/onboarding-context';
import { VaultSection } from './vault';

export default function Profile() {
  const [addDsModalOpen, setAddDsModalOpen] = useState(false);
  const [addDsModalKey, setAddDsModalKey] = useState(0);
  const [togglingDs, setTogglingDs] = useState<string | null>(null);
  const [removingDs, setRemovingDs] = useState<string | null>(null);
  const [dsError, setDsError] = useState<string | null>(null);

  const [clearing, setClearing] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [, clearAppData] = useClearAppData();
  const [{ data: dsData, fetching: dsFetching, error: dsQueryError }, reexecuteDs] = useListDataSources();
  const [, removeDataSource] = useRemoveDataSource();
  const [, toggleDataSource] = useToggleDataSource();
  const [, fetchDataSource] = useFetchDataSource();
  const [{ data: statusData }, reexecuteStatus] = useQuery<OnboardingStatusQueryResult>({
    query: ONBOARDING_STATUS_QUERY,
  });
  const [, resetOnboarding] = useMutation(RESET_ONBOARDING_MUTATION);
  const { openOnboarding, resetOnboardingStatus } = useOnboardingStatus();
  const jintelConfigured = statusData?.onboardingStatus?.jintelConfigured ?? false;

  function openAddDsModal() {
    setAddDsModalKey((k: number) => k + 1);
    setAddDsModalOpen(true);
  }

  const dataSources = [...(dsData?.listDataSources ?? [])]
    .filter((s) => !s.builtin)
    .sort((a, b) => a.priority - b.priority);

  const refreshDs = useCallback(() => {
    reexecuteDs({ requestPolicy: 'network-only' });
  }, [reexecuteDs]);

  async function handleToggleDs(id: string, enabled: boolean) {
    setTogglingDs(id);
    setDsError(null);
    try {
      const result = await toggleDataSource({ id, enabled });
      if (result.error || !result.data?.toggleDataSource.success) {
        setDsError(result.data?.toggleDataSource.error ?? result.error?.message ?? 'Toggle failed');
      }
    } finally {
      setTogglingDs(null);
      refreshDs();
    }
  }

  async function handleRemoveDs(id: string) {
    setRemovingDs(id);
    setDsError(null);
    try {
      const result = await removeDataSource({ id });
      if (result.error || !result.data?.removeDataSource.success) {
        setDsError(result.data?.removeDataSource.error ?? result.error?.message ?? 'Remove failed');
      }
    } finally {
      setRemovingDs(null);
      refreshDs();
    }
  }

  async function handleFetchDs(
    id: string,
    url?: string,
  ): Promise<{ ingested: number; duplicates: number; error?: string } | null> {
    const result = await fetchDataSource({ id, url });
    const fetchResult = result.data?.fetchDataSource;
    if (result.error) {
      return { ingested: 0, duplicates: 0, error: result.error.message };
    }
    if (!fetchResult?.success) {
      return { ingested: 0, duplicates: 0, error: fetchResult?.error ?? 'Fetch failed' };
    }
    return {
      ingested: fetchResult.signalsIngested,
      duplicates: fetchResult.duplicates,
    };
  }

  const handleResetOnboarding = useCallback(async () => {
    setResetting(true);
    try {
      const result = await resetOnboarding({});
      if (result.error) {
        console.error('Reset onboarding failed:', result.error.message);
      }
      // Clear client state and open modal regardless — the user explicitly
      // asked to reset, so start fresh even if the server cleanup was partial.
      resetOnboardingStatus();
      openOnboarding();
    } finally {
      setResetting(false);
    }
  }, [resetOnboarding, resetOnboardingStatus, openOnboarding]);

  return (
    <div className="flex-1 overflow-auto p-6 space-y-8">
      {/* ── Section 1: Intelligence Sources (Jintel hero + custom sources) ── */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-headline text-lg text-text-primary">Intelligence Sources</h2>
          <Button size="sm" onClick={openAddDsModal}>
            + Add Source
          </Button>
        </div>

        {/* Jintel — Primary Intelligence Source */}
        <Card className="border border-accent-primary/20">
          {jintelConfigured ? (
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-primary/10">
                  <svg
                    className="h-5 w-5 text-accent-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"
                    />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">Jintel Intelligence</span>
                    <Badge variant="success" size="xs">
                      Connected
                    </Badge>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    Real-time quotes, fundamentals, news sentiment, risk screening
                  </p>
                </div>
              </div>
              <a href="#vault" className="text-xs text-text-muted hover:text-text-secondary transition-colors">
                Manage in Vault
              </a>
            </div>
          ) : (
            <div className="space-y-4 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-primary/10 shrink-0">
                  <svg
                    className="h-5 w-5 text-accent-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-text-primary">Connect Jintel for full intelligence</h3>
                  <p className="mt-1 text-xs text-text-secondary">
                    Real-time quotes, enriched fundamentals, news sentiment, and risk screening.
                  </p>
                </div>
              </div>
              <JintelKeyForm onSuccess={() => reexecuteStatus({ requestPolicy: 'network-only' })} />
            </div>
          )}
        </Card>

        {/* Custom Data Sources (below Jintel) */}
        {dsFetching ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : dsQueryError ? (
          <p className="py-4 text-center text-sm text-error">Failed to load data sources.</p>
        ) : dataSources.length > 0 ? (
          <div className="mt-3 space-y-2">
            {dsError && <p className="text-sm text-error bg-error/10 rounded-lg px-3 py-2">{dsError}</p>}
            {dataSources.map((source) => (
              <DataSourceCard
                key={source.id}
                source={source}
                onToggle={handleToggleDs}
                onRemove={handleRemoveDs}
                onFetch={handleFetchDs}
                toggling={togglingDs === source.id}
                removing={removingDs === source.id}
              />
            ))}
          </div>
        ) : null}
      </section>

      <AddDataSourceModal
        key={addDsModalKey}
        open={addDsModalOpen}
        onClose={() => {
          setAddDsModalOpen(false);
          refreshDs();
        }}
      />

      {/* ── Section 2: Connected Platforms (coming soon) ── */}
      <Card title="Connected Platforms" section className="relative opacity-60 pointer-events-none select-none">
        <div className="absolute right-5 top-5">
          <Badge variant="neutral" size="xs">
            Coming Soon
          </Badge>
        </div>

        <div className="flex flex-col items-center py-8 text-center">
          <p className="text-sm text-text-muted">Direct platform connections are coming soon.</p>
        </div>
      </Card>

      {/* ── Section 3: Credential Vault ── */}
      <section id="vault">
        <VaultSection />
      </section>

      {/* ── Section 4: Danger Zone ── */}
      <section>
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wider text-error/70 mb-3">Danger Zone</h3>
          <Card className="border border-error/20 overflow-hidden">
            <DangerRow
              title="Reset onboarding"
              description="Clear server-side state and restart the onboarding flow"
              actionLabel="Reset"
              confirmLabel="Confirm"
              requireConfirm
              loading={resetting}
              onAction={handleResetOnboarding}
            />
            <div className="border-t border-error/10" />
            <DangerRow
              title="Clear app data"
              description="Removes portfolio, insights, sessions, and brain memory. Vault, config, and device identity are preserved."
              actionLabel="Clear"
              loading={clearing}
              confirmLabel="Confirm"
              requireConfirm
              onAction={async () => {
                setClearing(true);
                try {
                  const result = await clearAppData({});
                  if (result.error || result.data?.clearAppData === false) {
                    setClearing(false);
                    return;
                  }
                  window.location.href = '/';
                } catch {
                  setClearing(false);
                }
              }}
            />
          </Card>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Danger Row — consistent destructive-action row used in the Danger Zone
// ---------------------------------------------------------------------------

function DangerRow({
  title,
  description,
  actionLabel,
  confirmLabel,
  loading,
  requireConfirm,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  confirmLabel?: string;
  loading: boolean;
  requireConfirm?: boolean;
  onAction: () => void | Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex items-center justify-between px-5 py-4">
      <div className="min-w-0 mr-4">
        <p className="text-sm font-medium text-text-primary">{title}</p>
        <p className="text-xs text-text-muted mt-0.5">{description}</p>
      </div>
      <div className="shrink-0">
        {requireConfirm && confirming ? (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="danger"
              loading={loading}
              onClick={async () => {
                await onAction();
                setConfirming(false);
              }}
            >
              {confirmLabel ?? 'Confirm'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="danger"
            loading={loading}
            onClick={() => {
              if (requireConfirm) {
                setConfirming(true);
              } else {
                onAction();
              }
            }}
          >
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
