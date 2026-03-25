import { z } from 'zod';

/* ── Zod Schemas ─────────────────────────────── */

/** Validates a single manual position entry before submission. */
export const ManualEntrySchema = z.object({
  symbol: z
    .string()
    .min(1, 'Symbol is required')
    .regex(/^[A-Za-z0-9.\-/]+$/, 'Letters, digits, dots, hyphens only'),
  name: z.string(),
  quantity: z.string().refine((v) => v === '' || isFinitePositive(v), { message: 'Must be a positive number' }),
  avgEntry: z.string().refine((v) => v === '' || isFinitePositive(v), { message: 'Must be a positive number' }),
  marketPrice: z.string().refine((v) => v === '' || isFinitePositive(v), { message: 'Must be a positive number' }),
  marketValue: z.string().refine((v) => v === '' || isFinitePositive(v), { message: 'Must be a positive number' }),
});

export type ManualEntryErrors = Partial<Record<keyof z.infer<typeof ManualEntrySchema>, string>>;

function isFinitePositive(v: string): boolean {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0;
}

/* ── Input Sanitizers (called onChange) ───────── */

/** Allow only ticker characters: A-Z, 0-9, dot, hyphen, slash. Auto-uppercases. */
export function sanitizeSymbol(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9.\-/]/g, '')
    .slice(0, 10);
}

/** Allow only numeric input: digits and at most one decimal point. */
export function sanitizeNumeric(raw: string): string {
  // Strip everything except digits and dots
  let cleaned = raw.replace(/[^\d.]/g, '');
  // Keep only the first decimal point
  const dotIdx = cleaned.indexOf('.');
  if (dotIdx !== -1) {
    cleaned = cleaned.slice(0, dotIdx + 1) + cleaned.slice(dotIdx + 1).replace(/\./g, '');
  }
  return cleaned;
}

/** Allow only text characters for platform names. */
export function sanitizePlatformName(raw: string): string {
  return raw.replace(/[^\w\s\-'.&]/g, '').slice(0, 50);
}

/* ── Batch Validation ────────────────────────── */

/** Validate all entries, returning per-row error maps. */
export function validateEntries(entries: z.infer<typeof ManualEntrySchema>[]): {
  valid: boolean;
  errors: ManualEntryErrors[];
} {
  const errors: ManualEntryErrors[] = entries.map((entry) => {
    // Skip completely empty rows
    if (!entry.symbol && !entry.quantity && !entry.avgEntry && !entry.marketPrice) return {};

    const result = ManualEntrySchema.safeParse(entry);
    if (result.success) return {};

    const fieldErrors: ManualEntryErrors = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof ManualEntryErrors;
      if (!fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return fieldErrors;
  });

  const valid = errors.every((e) => Object.keys(e).length === 0);
  return { valid, errors };
}
