import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '../../lib/utils';
import { usePositions } from '../../api';
import { useOnboardingStatus } from '../../lib/onboarding-context';
import Spinner from '../common/spinner';
import Button from '../common/button';
import { DashboardCard } from '../common/dashboard-card';
import AddAccountModal from './add-account-modal';

const PLATFORM_DISPLAY: Record<string, string> = {
  INTERACTIVE_BROKERS: 'IBKR',
  ROBINHOOD: 'Robinhood',
  COINBASE: 'Coinbase',
  BINANCE: 'Binance',
  METAMASK: 'MetaMask',
  WEBULL: 'WeBull',
  SOFI: 'SoFi',
  SCHWAB: 'Schwab',
  FIDELITY: 'Fidelity',
  MOOMOO: 'Moomoo',
  PHANTOM: 'Phantom',
  MANUAL: 'Manual',
};

const PLATFORM_PALETTE = [
  'var(--color-accent-primary)',
  'var(--color-accent-secondary)',
  'var(--color-success)',
  'var(--color-warning)',
  'var(--color-info)',
  'var(--color-text-muted)',
];

interface AccountSummary {
  platform: string;
  name: string;
  totalValue: number;
  change: number;
}

interface AllocationSlice {
  name: string;
  value: number;
  color: string;
}

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function formatChange(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '' : '';
  return `${sign}${n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}`;
}

function DonutTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="rounded-lg border border-border bg-bg-card px-2.5 py-1.5 text-2xs shadow-lg">
      <span className="text-text-primary">{payload[0].name}</span>
    </div>
  );
}

export default function ConnectedAccountsCard() {
  const [{ data, fetching, error }, reexecuteQuery] = usePositions();
  const [modalOpen, setModalOpen] = useState(false);
  const { openOnboarding } = useOnboardingStatus();

  const accounts = useMemo<AccountSummary[]>(() => {
    const positions = data?.positions ?? [];
    if (positions.length === 0) return [];

    const grouped: Record<string, { totalValue: number; change: number }> = {};
    for (const pos of positions) {
      const key = pos.platform;
      if (!grouped[key]) grouped[key] = { totalValue: 0, change: 0 };
      grouped[key].totalValue += pos.marketValue;
      grouped[key].change += pos.dayChange ?? 0;
    }

    return Object.entries(grouped)
      .map(([platform, agg]) => ({
        platform,
        name: PLATFORM_DISPLAY[platform] ?? platform,
        totalValue: agg.totalValue,
        change: agg.change,
      }))
      .sort((a, b) => b.totalValue - a.totalValue);
  }, [data?.positions]);

  const allocation = useMemo<AllocationSlice[]>(() => {
    if (accounts.length === 0) return [];

    return accounts.map((account, idx) => ({
      name: account.name,
      value: account.totalValue,
      color: PLATFORM_PALETTE[idx % PLATFORM_PALETTE.length],
    }));
  }, [accounts]);

  const connectedPlatformIds = accounts.map((a) => a.platform);

  const handleAddSuccess = () => {
    reexecuteQuery({ requestPolicy: 'network-only' });
  };

  const addButton = (
    <button
      onClick={() => setModalOpen(true)}
      className="cursor-pointer text-2xs font-medium text-accent-primary transition-colors hover:text-accent-primary/80"
    >
      +Add Account
    </button>
  );

  const modal = (
    <AddAccountModal
      open={modalOpen}
      onClose={() => setModalOpen(false)}
      onSuccess={handleAddSuccess}
      connectedPlatforms={connectedPlatformIds}
    />
  );

  if (fetching) {
    return (
      <DashboardCard title="Connected Accounts" headerAction={addButton}>
        <div className="flex flex-1 items-center justify-center px-4 pb-4">
          <Spinner size="sm" />
        </div>
        {modal}
      </DashboardCard>
    );
  }

  if (error || accounts.length === 0) {
    return (
      <DashboardCard title="Connected Accounts" headerAction={addButton}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 pb-4">
          <p className="text-xs text-text-muted">No accounts connected yet</p>
          <Button variant="primary" size="sm" onClick={openOnboarding}>
            Continue setup
          </Button>
        </div>
        {modal}
      </DashboardCard>
    );
  }

  return (
    <DashboardCard title="Connected Accounts" headerAction={addButton}>
      <div className="flex min-h-0 flex-1 items-start gap-6 px-4 pb-4">
        {/* Account list */}
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          {accounts.map((account) => {
            const isPositive = account.change > 0;
            const isNeutral = account.change === 0;
            return (
              <div key={account.platform} className="flex items-baseline gap-2">
                <span className="text-xs font-medium text-text-primary">{account.name}</span>
                <span className="text-xs font-medium text-text-primary tabular-nums">
                  {formatCurrency(account.totalValue)}
                </span>
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    isNeutral ? 'text-text-muted' : isPositive ? 'text-success' : 'text-error',
                  )}
                >
                  {formatChange(account.change)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Donut chart — labels only on hover */}
        {allocation.length > 0 && (
          <div className="flex flex-shrink-0 flex-col items-center">
            <div className="h-[72px] w-[72px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocation}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={20}
                    outerRadius={34}
                    strokeWidth={1}
                    stroke="var(--color-bg-card)"
                  >
                    {allocation.map((slice) => (
                      <Cell key={slice.name} fill={slice.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {modal}
    </DashboardCard>
  );
}
