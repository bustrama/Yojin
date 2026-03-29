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
  logo: ReactNode;
}

const YOJIN_LOGO = <img src="/brand/yojin_icon_color.png" alt="Yojin" className="h-8 w-8 rounded-lg" />;

const AI_LOGOS = (
  <div className="flex items-center -space-x-2">
    <img src="/ai-providers/claude.png" alt="Claude" className="h-8 w-8 rounded-lg ring-2 ring-bg-card" />
    <img src="/ai-providers/openai.png" alt="OpenAI" className="h-8 w-8 rounded-lg ring-2 ring-bg-card" />
  </div>
);

const GATES: Record<'jintel' | 'ai', GateConfig> = {
  jintel: {
    title: 'Set up your Jintel API key',
    subtitle: 'Jintel is free to use. Connect it to unlock live market data and analytics.',
    cta: 'Set up in Profile',
    href: '/profile',
    logo: YOJIN_LOGO,
  },
  ai: {
    title: 'AI provider not configured',
    subtitle: 'Configure an AI provider to unlock this feature.',
    cta: 'Set up in Settings',
    href: '/settings',
    logo: AI_LOGOS,
  },
};

function getMissing(requires: Requirement, jintelConfigured: boolean, aiConfigured: boolean): ('jintel' | 'ai')[] {
  const missing: ('jintel' | 'ai')[] = [];
  if ((requires === 'jintel' || requires === 'both') && !jintelConfigured) missing.push('jintel');
  if ((requires === 'ai' || requires === 'both') && !aiConfigured) missing.push('ai');
  return missing;
}

// ─── Card-level gate (used inside CardBlurGate overlay) ─────
// CardBlurGate provides the card container, so this is just the content.

export function FeatureCardGate({ requires }: { requires: Requirement }) {
  const items: ('jintel' | 'ai')[] = requires === 'both' ? ['jintel', 'ai'] : [requires];
  const primary = GATES[items[0]];

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {primary.logo}
      <div>
        <p className="text-sm font-medium text-text-primary">{primary.title}</p>
        <p className="mt-1 text-xs leading-relaxed text-text-muted">{primary.subtitle}</p>
      </div>
      {items.length > 1 && <p className="text-xs leading-relaxed text-text-muted">{GATES[items[1]].subtitle}</p>}
      <div className="flex items-center gap-2">
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

// ─── Page-level gate (full-page centered) ───────────────────

export function PageFeatureGate({ requires, children }: { requires: Requirement; children: ReactNode }) {
  const { jintelConfigured, aiConfigured, loading } = useFeatureStatus();

  if (loading) return null;

  const missing = getMissing(requires, jintelConfigured, aiConfigured);
  if (missing.length === 0) return <>{children}</>;

  const primary = GATES[missing[0]];
  const secondary = missing.length > 1 ? GATES[missing[1]] : null;

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-bg-card px-8 py-8 text-center shadow-lg">
        {primary.logo}
        <div>
          <h2 className="text-base font-medium text-text-primary">{primary.title}</h2>
          <p className="mt-1.5 text-sm text-text-muted">{primary.subtitle}</p>
        </div>

        <Link to={primary.href}>
          <Button variant="primary" size="sm">
            {primary.cta}
          </Button>
        </Link>

        {secondary && (
          <>
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-2xs text-text-muted">also requires</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="flex items-center gap-3">
              {secondary.logo}
              <div className="text-left">
                <p className="text-sm text-text-muted">{secondary.subtitle}</p>
              </div>
            </div>
            <Link to={secondary.href}>
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

// ─── Branded gate card (standalone, for use in any overlay) ──

interface GateCardProps {
  requires: 'jintel' | 'ai';
  title?: string;
  subtitle?: string;
  cta?: string;
  href?: string;
  action?: ReactNode;
}

export function GateCard({ requires, title, subtitle, cta, href, action }: GateCardProps) {
  const gate = GATES[requires];
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-bg-card/95 px-6 py-5 text-center shadow-lg backdrop-blur-sm">
      {gate.logo}
      <div>
        <p className="text-sm font-medium text-text-primary">{title ?? gate.title}</p>
        <p className="mt-1 max-w-[260px] text-xs leading-relaxed text-text-muted">{subtitle ?? gate.subtitle}</p>
      </div>
      {action ?? (
        <Link to={href ?? gate.href}>
          <Button size="sm" variant="secondary">
            {cta ?? gate.cta}
          </Button>
        </Link>
      )}
    </div>
  );
}
