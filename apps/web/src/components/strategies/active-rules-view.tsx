import { useState } from 'react';

import StrategyCard from './strategy-card.js';
import StrategyDetailModal from './strategy-detail-modal.js';
import Spinner from '../common/spinner.js';
import { useStrategies, useToggleStrategy } from '../../api/hooks/index.js';
import type { Strategy } from './types.js';

export default function ActiveRulesView() {
  const [result] = useStrategies();
  const [, toggleStrategy] = useToggleStrategy();
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const strategies = result.data?.strategies ?? [];
  const active = strategies.filter((s) => s.active);
  const available = strategies.filter((s) => !s.active);

  async function handleToggle(id: string, newActive: boolean) {
    setToggleError(null);
    const res = await toggleStrategy({ id, active: newActive });
    if (res.error) setToggleError(res.error.message);
  }

  if (result.fetching) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner label="Loading strategies..." />
      </div>
    );
  }

  if (result.error) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-error">Failed to load strategies. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {toggleError && (
        <div className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">{toggleError}</div>
      )}

      {active.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-text-secondary mb-3">Active ({active.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.map((strategy) => (
              <StrategyCard
                key={strategy.id}
                strategy={strategy}
                onToggle={handleToggle}
                onClick={setSelectedStrategy}
              />
            ))}
          </div>
        </section>
      )}

      {available.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-text-secondary mb-3">Available ({available.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {available.map((strategy) => (
              <StrategyCard
                key={strategy.id}
                strategy={strategy}
                onToggle={handleToggle}
                onClick={setSelectedStrategy}
              />
            ))}
          </div>
        </section>
      )}

      {strategies.length === 0 && !result.fetching && (
        <div className="text-center py-20 text-text-muted">
          <p className="text-sm">No strategies yet.</p>
        </div>
      )}

      {selectedStrategy && (
        <StrategyDetailModal
          open={!!selectedStrategy}
          strategyId={selectedStrategy.id}
          onClose={() => setSelectedStrategy(null)}
        />
      )}
    </div>
  );
}
