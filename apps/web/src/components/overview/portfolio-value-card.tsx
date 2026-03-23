import { cn } from '../../lib/utils';
import { usePortfolio } from '../../api';
import Spinner from '../common/spinner';

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatChange(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`;
}

function formatPercent(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export default function PortfolioValueCard() {
  const [{ data, fetching, error }] = usePortfolio();

  if (fetching) {
    return (
      <div className="flex min-w-0 items-center justify-center rounded-lg border border-border bg-bg-card p-6">
        <Spinner size="sm" />
      </div>
    );
  }

  if (error || !data?.portfolio) {
    return (
      <div className="flex min-w-0 flex-col rounded-lg border border-border bg-bg-card p-6">
        <p className="text-2xs uppercase tracking-wider text-text-secondary">Portfolio Value</p>
        <p className="mt-2 text-3xl font-bold text-text-muted">N/A</p>
      </div>
    );
  }

  const { totalValue, totalPnl, totalPnlPercent } = data.portfolio;
  const isPositive = totalPnl > 0;
  const isNeutral = totalPnl === 0;

  return (
    <div className="flex min-w-0 flex-col justify-center rounded-lg border border-border bg-bg-card p-6">
      <p className="text-2xs uppercase tracking-wider text-text-secondary">Portfolio Value</p>
      <p className="mt-2 text-3xl font-bold text-text-primary">{formatCurrency(totalValue)}</p>
      <div
        className={cn(
          'mt-1.5 flex items-center gap-1.5 text-xs',
          isNeutral ? 'text-text-muted' : isPositive ? 'text-success' : 'text-error',
        )}
      >
        {!isNeutral && <span className="text-2xs">{isPositive ? '\u25B2' : '\u25BC'}</span>}
        <span className="font-medium">{formatChange(totalPnl)}</span>
        <span className="font-medium">{formatPercent(totalPnlPercent)}</span>
        <span className="text-text-muted">today</span>
      </div>
    </div>
  );
}
