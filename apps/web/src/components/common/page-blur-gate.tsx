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

const YOJIN_LOGO = <img src="/brand/yojin_icon_color.png" alt="Yojin" className="h-9 w-9 rounded-lg" />;

const AI_LOGOS = (
  <div className="flex items-center -space-x-2">
    <img src="/ai-providers/claude.png" alt="Claude" className="h-9 w-9 rounded-lg ring-2 ring-bg-card" />
    <img src="/ai-providers/openai.png" alt="OpenAI" className="h-9 w-9 rounded-lg ring-2 ring-bg-card" />
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

interface PageBlurGateProps {
  requires: Requirement;
  mockContent: ReactNode;
  children: ReactNode;
}

/**
 * Page-level feature gate with blurred mock content preview.
 * Shows mock page content behind a frosted glass overlay with a branded gate card.
 * Use this instead of `PageFeatureGate` when you have mock content to preview.
 */
export function PageBlurGate({ requires, mockContent, children }: PageBlurGateProps) {
  const { jintelConfigured, aiConfigured, loading } = useFeatureStatus();

  if (loading) return null;

  const missing: ('jintel' | 'ai')[] = [];
  if ((requires === 'jintel' || requires === 'both') && !jintelConfigured) missing.push('jintel');
  if ((requires === 'ai' || requires === 'both') && !aiConfigured) missing.push('ai');

  if (missing.length === 0) return <>{children}</>;

  const primary = GATES[missing[0]];
  const secondary = missing.length > 1 ? GATES[missing[1]] : null;

  return (
    <div className="relative flex flex-1 overflow-hidden">
      {/* Mock content behind blur — decorative only */}
      <div className="pointer-events-none flex flex-1 select-none" aria-hidden="true">
        {mockContent}
      </div>

      {/* Frosted overlay with branded gate card */}
      <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg-primary/70 backdrop-blur-[4px]">
        <div className="flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-bg-card px-8 py-8 text-center shadow-xl">
          {primary.logo}
          <div>
            <h2 className="text-base font-medium text-text-primary">{primary.title}</h2>
            <p className="mt-1.5 max-w-[280px] text-sm text-text-muted">{primary.subtitle}</p>
          </div>

          <Link to={primary.href}>
            <Button variant="primary" size="sm">
              {primary.cta}
            </Button>
          </Link>

          {secondary && (
            <>
              <div className="flex w-full items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-2xs text-text-muted">also requires</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="flex items-center gap-3">
                {secondary.logo}
                <p className="text-left text-sm text-text-muted">{secondary.subtitle}</p>
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
    </div>
  );
}
