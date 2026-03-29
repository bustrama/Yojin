import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useFeatureStatus } from '../../lib/feature-status';
import Button from './button';

type Requirement = 'jintel' | 'ai' | 'both';

interface GateConfig {
  title: string;
  subtitle: string;
  cta: string;
  href: string;
}

const GATES: Record<'jintel' | 'ai', GateConfig> = {
  jintel: {
    title: 'Jintel API key required',
    subtitle: 'Connect Jintel to unlock live market data and analytics.',
    cta: 'Set up in Profile',
    href: '/profile',
  },
  ai: {
    title: 'AI provider required',
    subtitle: 'Configure an AI provider to unlock this feature.',
    cta: 'Set up in Settings',
    href: '/settings',
  },
};

function getMissing(requires: Requirement, jintelConfigured: boolean, aiConfigured: boolean): ('jintel' | 'ai')[] {
  const missing: ('jintel' | 'ai')[] = [];
  if ((requires === 'jintel' || requires === 'both') && !jintelConfigured) missing.push('jintel');
  if ((requires === 'ai' || requires === 'both') && !aiConfigured) missing.push('ai');
  return missing;
}

// ─── Card-level gate ────────────────────────────────────

export function FeatureCardGate({ requires }: { requires: Requirement }) {
  const items: ('jintel' | 'ai')[] = requires === 'both' ? ['jintel', 'ai'] : [requires];

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 pb-5 text-center">
      <p className="text-xs font-medium text-text-secondary">{GATES[items[0]].title}</p>
      <p className="mt-1 max-w-[220px] text-2xs leading-relaxed text-text-muted">{GATES[items[0]].subtitle}</p>
      {items.length > 1 && (
        <p className="mt-1 max-w-[220px] text-2xs leading-relaxed text-text-muted">{GATES[items[1]].subtitle}</p>
      )}
      <div className="mt-3 flex items-center gap-2">
        {items.map((req) => (
          <Link key={req} to={GATES[req].href}>
            <Button size="sm" variant="secondary">
              {GATES[req].cta}
            </Button>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Page-level gate ────────────────────────────────────

export function PageFeatureGate({ requires, children }: { requires: Requirement; children: ReactNode }) {
  const { jintelConfigured, aiConfigured, loading } = useFeatureStatus();

  if (loading) return null;

  const missing = getMissing(requires, jintelConfigured, aiConfigured);
  if (missing.length === 0) return <>{children}</>;

  const primary = GATES[missing[0]];
  const secondary = missing.length > 1 ? GATES[missing[1]] : null;

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center text-center">
        <h2 className="text-base font-medium text-text-primary">{primary.title}</h2>
        <p className="mt-1.5 text-sm text-text-muted">{primary.subtitle}</p>

        <Link to={primary.href} className="mt-4">
          <Button variant="primary" size="sm">
            {primary.cta}
          </Button>
        </Link>

        {secondary && (
          <>
            <p className="mt-4 text-sm text-text-muted">{secondary.subtitle}</p>
            <Link to={secondary.href} className="mt-2">
              <Button variant="secondary" size="sm">
                {secondary.cta}
              </Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
