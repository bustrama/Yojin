import { cn } from '../../lib/utils';

type ActionType = 'TRADE' | 'SCAN' | 'ALERT';

interface ActionEntry {
  time: string;
  type: ActionType;
  message: string;
  txId?: string;
}

const TYPE_STYLES: Record<ActionType, string> = {
  TRADE: 'bg-accent-primary/15 text-accent-primary',
  SCAN: 'bg-success/15 text-success',
  ALERT: 'bg-warning/15 text-warning',
};

const mockActions: ActionEntry[] = [
  {
    time: '14:32',
    type: 'TRADE',
    message: 'BUY 0.5 ETH @ $3,412 on Bybit (momentum-breakout)',
    txId: '#A78D2C1',
  },
  {
    time: '13:15',
    type: 'SCAN',
    message: 'Heartbeat review completed \u2014 no action required',
  },
  {
    time: '12:41',
    type: 'TRADE',
    message: 'SELL 10 TSLA @ $292 on Alpaca (momentum-breakout)',
    txId: 'Tx2d0F89',
  },
  {
    time: '11:00',
    type: 'ALERT',
    message: 'Earnings proximity alert generated for AAPL',
  },
  {
    time: '09:30',
    type: 'SCAN',
    message: 'Morning digest delivered via Telegram',
  },
];

export default function YojinActionsCard() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-bg-card p-5">
      <div className="mb-3 flex flex-shrink-0 items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary font-headline">Yojin Actions</h3>
        <span className="text-2xs text-text-muted">Recent Activity</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto">
        {mockActions.map((action) => (
          <div key={`${action.time}-${action.type}`} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex-shrink-0 text-2xs tabular-nums text-text-muted">{action.time}</span>
            <span
              className={cn(
                'flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                TYPE_STYLES[action.type],
              )}
            >
              {action.type}
            </span>
            <span className="min-w-0 flex-1 text-xs leading-snug text-text-secondary">
              {action.message}
              {action.txId && <span className="ml-1 text-text-muted">{action.txId}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
