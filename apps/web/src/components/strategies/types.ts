export type { Strategy, StrategyCategory } from '../../api/types.js';

export function formatStyle(style: string): string {
  return style.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
