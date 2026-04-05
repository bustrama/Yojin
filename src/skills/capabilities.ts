import { z } from 'zod';

export const DataCapabilitySchema = z.enum([
  'market_data',
  'technicals',
  'news',
  'research',
  'sentiment',
  'fundamentals',
  'filings',
  'derivatives',
  'portfolio',
  'macro_data',
]);
export type DataCapability = z.infer<typeof DataCapabilitySchema>;

const AVAILABLE_CAPABILITIES: DataCapability[] = [
  'market_data',
  'technicals',
  'news',
  'research',
  'sentiment',
  'fundamentals',
  'filings',
  'portfolio',
  'macro_data',
];

export function getAvailableCapabilities(): DataCapability[] {
  return [...AVAILABLE_CAPABILITIES];
}

export interface CapabilityCheckResult {
  required: DataCapability[];
  available: DataCapability[];
  missing: DataCapability[];
  status: 'executable' | 'limited' | 'unavailable';
}

export function checkCapabilities(requires: DataCapability[]): CapabilityCheckResult {
  const availableSet = new Set(AVAILABLE_CAPABILITIES);
  const available = requires.filter((r) => availableSet.has(r));
  const missing = requires.filter((r) => !availableSet.has(r));

  let status: CapabilityCheckResult['status'];
  if (missing.length === 0) status = 'executable';
  else if (available.length > 0) status = 'limited';
  else status = 'unavailable';

  return { required: requires, available, missing, status };
}
