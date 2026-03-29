/**
 * AI config resolver — read and update the active AI provider config at runtime.
 *
 * Writes to data/config/ai-provider.json, then hot-reloads the ProviderRouter
 * so changes take effect immediately without a restart.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ProviderRouter } from '../../../ai-providers/router.js';
import { AIProviderConfigSchema } from '../../../config/config.js';
import { createSubsystemLogger } from '../../../logging/logger.js';
import { resolveDataRoot } from '../../../paths.js';

const logger = createSubsystemLogger('ai-config');

// ---------------------------------------------------------------------------
// Module-level state — wired at startup from composition
// ---------------------------------------------------------------------------

let router: ProviderRouter | null = null;

export function setAiConfigProviderRouter(r: ProviderRouter): void {
  router = r;
}

// ---------------------------------------------------------------------------
// GraphQL types (mirrored from schema)
// ---------------------------------------------------------------------------

interface AiConfigGql {
  defaultModel: string;
  defaultProvider: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readAiConfig(): Promise<AiConfigGql> {
  const configPath = join(resolveDataRoot(), 'config', 'ai-provider.json');
  try {
    const raw = await readFile(configPath, 'utf-8');
    const parsed = AIProviderConfigSchema.parse(JSON.parse(raw));
    return { defaultModel: parsed.defaultModel, defaultProvider: parsed.defaultProvider };
  } catch {
    const defaults = AIProviderConfigSchema.parse({});
    return { defaultModel: defaults.defaultModel, defaultProvider: defaults.defaultProvider };
  }
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

export async function aiConfigQuery(): Promise<AiConfigGql> {
  return readAiConfig();
}

// ---------------------------------------------------------------------------
// Mutation
// ---------------------------------------------------------------------------

export async function saveAiConfigMutation(
  _: unknown,
  args: { input: { defaultModel: string; defaultProvider?: string } },
): Promise<AiConfigGql> {
  const { defaultModel, defaultProvider } = args.input;
  const configPath = join(resolveDataRoot(), 'config', 'ai-provider.json');

  // Read existing config to preserve other fields (fallback, etc.)
  let existing: Record<string, unknown> = {};
  try {
    const raw = await readFile(configPath, 'utf-8');
    existing = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // File may not exist yet — start fresh
  }

  const updated: Record<string, unknown> = { ...existing, defaultModel };
  if (defaultProvider) {
    updated.defaultProvider = defaultProvider;
  }
  await mkdir(join(resolveDataRoot(), 'config'), { recursive: true });
  await writeFile(configPath, JSON.stringify(updated, null, 2), 'utf-8');

  // Hot-reload the router so the new model takes effect immediately
  if (router) {
    try {
      await router.loadConfig();
    } catch (err) {
      logger.warn('Failed to hot-reload AI config after save', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const resolvedProvider = defaultProvider ?? (existing.defaultProvider as string | undefined) ?? 'claude-code';
  logger.info('AI config saved', { defaultModel, defaultProvider: resolvedProvider });

  return {
    defaultModel,
    defaultProvider: resolvedProvider,
  };
}
