import { useState } from 'react';
import { useMutation } from 'urql';
import { useOnboarding } from '../../lib/onboarding-context';
import { OnboardingShell } from '../../components/onboarding/onboarding-shell';
import Button from '../../components/common/button';
import { SAVE_AI_CONFIG_MUTATION } from '../../api/documents';
import { cn } from '../../lib/utils';

type Provider = 'claude' | 'codex';

interface ProviderConfig {
  id: Provider;
  name: string;
  subtitle: string;
  logo: string;
  /** Backend provider ID used by ProviderRouter */
  backendId: 'claude-code' | 'codex';
  method: 'keychain' | 'codex';
  defaultModel: string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'claude',
    name: 'Claude Code',
    subtitle: 'Anthropic',
    logo: '/ai-providers/claude.png',
    backendId: 'claude-code',
    method: 'keychain',
    defaultModel: 'claude-opus-4-6',
  },
  {
    id: 'codex',
    name: 'Codex',
    subtitle: 'OpenAI',
    logo: '/ai-providers/openai.png',
    backendId: 'codex',
    method: 'codex',
    defaultModel: 'gpt-5.4',
  },
];

export function Step1AiBrain() {
  const { state, updateState, nextStep, prevStep } = useOnboarding();
  const [, saveAiConfig] = useMutation(SAVE_AI_CONFIG_MUTATION);

  const [selected, setSelected] = useState<Provider>(state.aiProvider?.method === 'codex' ? 'codex' : 'claude');

  const handleContinue = () => {
    const provider = PROVIDERS.find((p) => p.id === selected);
    if (!provider) return;
    updateState({
      aiProvider: { method: provider.method, model: provider.defaultModel, validated: true },
    });
    // Persist provider + model to backend so settings page reflects the choice
    saveAiConfig({ input: { defaultProvider: provider.backendId, defaultModel: provider.defaultModel } });
    nextStep();
  };

  return (
    <OnboardingShell currentStep={1}>
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div
          className="mb-8 text-center opacity-0 [animation:onboarding-fade-up_0.5s_ease-out_forwards]"
          style={{ animationDelay: '0ms' }}
        >
          <h1 className="mb-2 font-headline text-2xl text-text-primary">Connect your AI brain</h1>
          <p className="text-sm text-text-secondary">Choose which AI assistant powers Yojin.</p>
        </div>

        {/* Provider cards */}
        <div
          className="mb-8 grid grid-cols-2 gap-4 opacity-0 [animation:onboarding-fade-up_0.5s_ease-out_forwards]"
          style={{ animationDelay: '100ms' }}
        >
          {PROVIDERS.map((p) => {
            const isSelected = selected === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p.id)}
                className={cn(
                  'group relative flex flex-col items-center gap-4 rounded-2xl border-2 px-6 py-8 transition-all duration-300 cursor-pointer',
                  isSelected
                    ? 'border-accent-primary bg-accent-glow shadow-[0_0_24px_-4px_var(--color-accent-primary)]'
                    : 'border-border bg-bg-card hover:border-accent-primary/40 hover:bg-bg-hover/60',
                )}
              >
                {/* Logo */}
                <div
                  className={cn(
                    'flex h-16 w-16 items-center justify-center rounded-2xl transition-transform duration-300',
                    isSelected ? 'scale-110' : 'group-hover:scale-105',
                  )}
                >
                  <img src={p.logo} alt={p.name} className="h-14 w-14 rounded-xl" />
                </div>

                {/* Name + subtitle */}
                <div className="text-center">
                  <p
                    className={cn(
                      'text-base font-semibold transition-colors',
                      isSelected ? 'text-accent-primary' : 'text-text-primary',
                    )}
                  >
                    {p.name}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">{p.subtitle}</p>
                </div>

                {/* Selection ring */}
                <div
                  className={cn(
                    'absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full transition-all duration-200',
                    isSelected ? 'bg-accent-primary scale-100' : 'border-2 border-border-light scale-90',
                  )}
                >
                  {isSelected && (
                    <svg
                      className="h-3.5 w-3.5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={3}
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Navigation */}
        <div
          className="flex items-center justify-between opacity-0 [animation:onboarding-fade-up_0.5s_ease-out_forwards]"
          style={{ animationDelay: '200ms' }}
        >
          <Button variant="ghost" size="md" onClick={prevStep}>
            <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Back
          </Button>
          <Button variant="primary" size="md" onClick={handleContinue}>
            Continue
            <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </Button>
        </div>
      </div>
    </OnboardingShell>
  );
}
