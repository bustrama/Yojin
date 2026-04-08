/**
 * Provider credential error detection and invalidation hook.
 *
 * Decouples the agent-loop (src/core) from the vault/config layer
 * (src/api/graphql/resolvers) by letting the composition root register a
 * cleanup handler that the agent loop fires when it detects an auth error.
 *
 * Registration (composition root / ai-config resolver):
 *   registerCredentialErrorHandler(clearDefaultProviderCredential);
 *
 * Detection + dispatch (agent-loop):
 *   if (isProviderCredentialError(err)) void handleProviderCredentialError();
 */

import { createSubsystemLogger } from '../logging/logger.js';

const logger = createSubsystemLogger('credential-error');

/** Handler registered by the composition layer to clean up an invalid credential. */
let credentialErrorHandler: (() => Promise<void>) | undefined;

/**
 * Register the function that should run when a credential error is detected.
 * Called once from the ai-config resolver after the vault is wired up.
 */
export function registerCredentialErrorHandler(handler: () => Promise<void>): void {
  credentialErrorHandler = handler;
}

/**
 * Returns true when the error indicates the stored provider credential is
 * invalid or expired (not a transient network/rate-limit problem).
 *
 * Covers:
 *   - HTTP 401 (Anthropic SDK AuthenticationError)
 *   - HTTP 403 (access denied — key revoked)
 *   - Anthropic "authentication_error" error type
 *   - Expired OAuth tokens
 *   - Invalid / malformed API key messages
 */
export function isProviderCredentialError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as Record<string, unknown>;
  if (e.status === 401 || e.status === 403) return true;
  const msg = String(e.message ?? err);
  return (
    msg.includes('authentication_error') ||
    msg.includes('OAuth token has expired') ||
    msg.includes('invalid_api_key') ||
    msg.includes('invalid x-api-key') ||
    msg.includes('Invalid API key') ||
    msg.includes('Incorrect API key') ||
    msg.includes('API key has been revoked')
  );
}

/**
 * Fire the registered credential error handler (best-effort, non-blocking).
 * Safe to call from any layer — logs and swallows handler failures so the
 * original error is never suppressed.
 */
export async function handleProviderCredentialError(): Promise<void> {
  if (!credentialErrorHandler) {
    logger.warn('Provider credential error detected but no handler is registered');
    return;
  }
  try {
    await credentialErrorHandler();
  } catch (handlerErr) {
    logger.error('Credential error handler failed', {
      error: handlerErr instanceof Error ? handlerErr.message : String(handlerErr),
    });
  }
}
