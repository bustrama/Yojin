import { formatStyle } from './types.js';
import type { Skill, SkillCategory } from './types.js';
import Badge from '../common/badge';
import type { BadgeVariant } from '../common/badge';
import { cn } from '../../lib/utils';

const categoryVariant: Record<SkillCategory, BadgeVariant> = {
  RISK: 'error',
  PORTFOLIO: 'warning',
  MARKET: 'market',
  RESEARCH: 'success',
};

const sourceLabel: Record<string, string> = {
  'built-in': 'Built-in',
  custom: 'Custom',
  community: 'Community',
};

const sourceVariant: Record<string, BadgeVariant> = {
  'built-in': 'neutral',
  custom: 'warning',
  community: 'info',
};

interface SkillCardProps {
  skill: Skill;
  onToggle?: (id: string, active: boolean) => void;
  onClick?: (skill: Skill) => void;
}

export default function SkillCard({ skill, onToggle, onClick }: SkillCardProps) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(skill)}
      className={cn(
        'bg-bg-card border border-border rounded-xl p-4 hover:border-accent-primary',
        'hover:shadow-[0_0_12px_var(--color-accent-glow)] transition-all',
        'flex flex-col justify-between min-h-[160px] cursor-pointer text-left w-full',
      )}
    >
      <div>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Badge
              variant={categoryVariant[skill.category]}
              size="xs"
              outline
              className="rounded font-semibold tracking-wide uppercase"
            >
              {skill.category}
            </Badge>
            {skill.style && (
              <Badge variant="neutral" size="xs" className="rounded">
                {formatStyle(skill.style)}
              </Badge>
            )}
          </div>

          <label className="relative inline-flex items-center" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={skill.active}
              onChange={() => onToggle?.(skill.id, !skill.active)}
              className="sr-only peer"
              aria-label={`Toggle ${skill.name} ${skill.active ? 'off' : 'on'}`}
            />
            <div
              className={cn(
                'w-8 h-[18px] rounded-full transition-colors',
                'peer-checked:bg-accent-primary bg-bg-tertiary',
                'after:content-[""] after:absolute after:top-[2px] after:left-[2px]',
                'after:bg-white after:rounded-full after:h-[14px] after:w-[14px]',
                'after:transition-transform peer-checked:after:translate-x-[14px]',
              )}
            />
          </label>
        </div>

        <h3 className="text-text-primary font-semibold mt-2.5 text-sm leading-snug">{skill.name}</h3>
        <p className="text-text-secondary text-xs mt-1 leading-relaxed line-clamp-2">{skill.description}</p>
      </div>

      <div className="flex items-center gap-2 mt-4 pt-1">
        <Badge variant={sourceVariant[skill.source] ?? 'neutral'} className="rounded">
          {sourceLabel[skill.source] ?? skill.source}
        </Badge>
        <span className="text-text-muted text-2xs">
          {skill.createdBy} &bull; {skill.createdAt}
        </span>
      </div>
    </button>
  );
}
