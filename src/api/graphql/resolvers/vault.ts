/**
 * Vault resolvers — vaultStatus, listVaultSecrets,
 * unlockVault, addVaultSecret, updateVaultSecret, deleteVaultSecret.
 *
 * Module-level state pattern: setVault is called once during server startup
 * to inject the EncryptedVault instance.
 */

import type { SecretMeta } from '../../../trust/vault/types.js';
import type { EncryptedVault } from '../../../trust/vault/vault.js';

let vault: EncryptedVault | undefined;

/** Called once during server startup to inject the vault. */
export function setVault(v: EncryptedVault): void {
  vault = v;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VaultStatus {
  isUnlocked: boolean;
  hasPassphrase: boolean;
  secretCount: number;
}

interface VaultResult {
  success: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Query resolvers
// ---------------------------------------------------------------------------

export async function vaultStatusQuery(): Promise<VaultStatus> {
  if (!vault) return { isUnlocked: false, hasPassphrase: false, secretCount: 0 };

  const isUnlocked = vault.isUnlocked;
  const hasPassphrase = vault.hasPassphrase;
  let secretCount = 0;
  if (isUnlocked) {
    const keys = await vault.list();
    secretCount = keys.length;
  }

  return { isUnlocked, hasPassphrase, secretCount };
}

export async function listVaultSecretsQuery(): Promise<SecretMeta[]> {
  if (!vault) return [];
  if (!vault.isUnlocked) return [];
  return vault.listWithMeta();
}

// ---------------------------------------------------------------------------
// Brute-force protection for vault unlock
// ---------------------------------------------------------------------------

const MAX_UNLOCK_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60_000; // 1 minute base lockout

let failedAttempts = 0;
let lockoutUntil = 0;

// ---------------------------------------------------------------------------
// Mutation resolvers
// ---------------------------------------------------------------------------

export async function unlockVaultMutation(_parent: unknown, args: { passphrase: string }): Promise<VaultResult> {
  if (!vault) return { success: false, error: 'Vault not configured' };

  // Check lockout
  const now = Date.now();
  if (failedAttempts >= MAX_UNLOCK_ATTEMPTS && now < lockoutUntil) {
    const remainingSec = Math.ceil((lockoutUntil - now) / 1000);
    return { success: false, error: `Too many failed attempts. Try again in ${remainingSec}s.` };
  }

  try {
    await vault.unlock(args.passphrase);
    failedAttempts = 0;
    lockoutUntil = 0;
    return { success: true };
  } catch (err) {
    failedAttempts++;
    if (failedAttempts >= MAX_UNLOCK_ATTEMPTS) {
      // Exponential backoff: 1min, 2min, 4min, ...
      const multiplier = Math.pow(2, Math.floor(failedAttempts / MAX_UNLOCK_ATTEMPTS) - 1);
      lockoutUntil = now + LOCKOUT_DURATION_MS * multiplier;
    }
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function setVaultPassphraseMutation(
  _parent: unknown,
  args: { newPassphrase: string },
): Promise<VaultResult> {
  if (!vault) return { success: false, error: 'Vault not configured' };
  if (!vault.isUnlocked) return { success: false, error: 'Vault is locked' };

  try {
    await vault.setPassphrase(args.newPassphrase);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function changeVaultPassphraseMutation(
  _parent: unknown,
  args: { currentPassphrase: string; newPassphrase: string },
): Promise<VaultResult> {
  if (!vault) return { success: false, error: 'Vault not configured' };
  if (!vault.isUnlocked) return { success: false, error: 'Vault is locked' };

  try {
    await vault.changePassphrase(args.currentPassphrase, args.newPassphrase);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function addVaultSecretMutation(
  _parent: unknown,
  args: { input: { key: string; value: string } },
): Promise<VaultResult> {
  if (!vault) return { success: false, error: 'Vault not configured' };
  if (!vault.isUnlocked) return { success: false, error: 'Vault is locked' };

  try {
    const exists = await vault.has(args.input.key);
    if (exists) {
      return { success: false, error: `Secret "${args.input.key}" already exists. Use update instead.` };
    }
    await vault.set(args.input.key, args.input.value);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function updateVaultSecretMutation(
  _parent: unknown,
  args: { input: { key: string; value: string } },
): Promise<VaultResult> {
  if (!vault) return { success: false, error: 'Vault not configured' };
  if (!vault.isUnlocked) return { success: false, error: 'Vault is locked' };

  try {
    const exists = await vault.has(args.input.key);
    if (!exists) {
      return { success: false, error: `Secret "${args.input.key}" not found` };
    }
    await vault.set(args.input.key, args.input.value);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function deleteVaultSecretMutation(_parent: unknown, args: { key: string }): Promise<VaultResult> {
  if (!vault) return { success: false, error: 'Vault not configured' };
  if (!vault.isUnlocked) return { success: false, error: 'Vault is locked' };

  try {
    await vault.delete(args.key);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
