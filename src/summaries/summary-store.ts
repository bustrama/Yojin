/**
 * Summary store — append-only JSONL storage with date-partitioned files.
 *
 * Stores Summaries that require human approval (PENDING -> APPROVED | REJECTED | EXPIRED).
 * Updates are appended as new lines — the highest-version entry for each ID wins on read.
 *
 * Storage layout:
 *   data/summaries/
 *     2026-03-21.jsonl
 *     2026-03-22.jsonl
 */

import { appendFile, mkdir, readFile, readdir, rename, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { Summary, SummaryStatus } from './types.js';
import { SummarySchema } from './types.js';
import { createSubsystemLogger } from '../logging/logger.js';

const logger = createSubsystemLogger('summary-store');

export interface SummaryStoreOptions {
  dir: string; // e.g. 'data/summaries'
}

interface SummaryQueryFilter {
  status?: SummaryStatus;
  since?: string; // ISO date string
  limit?: number;
  dismissed?: boolean;
}

type SummaryResult<T> = { success: true; data: T } | { success: false; error: string };

export class SummaryStore {
  private readonly dir: string;
  private dirCreated = false;

  private migrationDone = false;

  constructor(options: SummaryStoreOptions) {
    this.dir = options.dir;
  }

  /**
   * Migrate legacy data/actions/ JSONL files into data/summaries/.
   * Called lazily on first read. Moves files rather than copying to avoid
   * double-counting. Safe to call multiple times — skips if already done
   * or if legacy dir doesn't exist.
   */
  private async migrateLegacyActions(): Promise<void> {
    if (this.migrationDone) return;
    this.migrationDone = true;

    const legacyDir = join(dirname(this.dir), 'actions');
    try {
      await stat(legacyDir);
    } catch {
      return; // legacy dir doesn't exist — nothing to migrate
    }

    await this.ensureDir();
    let migrated = 0;
    try {
      const entries = await readdir(legacyDir);
      for (const entry of entries) {
        if (!entry.endsWith('.jsonl')) continue;
        const destPath = join(this.dir, entry);
        try {
          await stat(destPath);
          // File already exists in summaries — skip
          continue;
        } catch {
          // Doesn't exist yet — move it
        }
        await rename(join(legacyDir, entry), destPath);
        migrated++;
      }
      if (migrated > 0) {
        logger.info(`Migrated ${migrated} legacy action file(s) to summaries/`);
      }
    } catch (err) {
      logger.warn('Failed to migrate legacy actions', { error: String(err) });
    }
  }

  /** Create a new summary and append it to the date-partitioned store. */
  async create(summary: Summary): Promise<SummaryResult<Summary>> {
    const parsed = SummarySchema.safeParse(summary);
    if (!parsed.success) {
      return { success: false, error: `Invalid summary: ${parsed.error.message}` };
    }

    await this.appendSummary(parsed.data);
    logger.info('Summary created', { id: parsed.data.id, source: parsed.data.source });
    return { success: true, data: parsed.data };
  }

  /** Approve a pending summary. Appends updated version (append-only). */
  async approve(id: string): Promise<SummaryResult<Summary>> {
    return this.resolve(id, 'APPROVED', 'user');
  }

  /** Reject a pending summary. Appends updated version (append-only). */
  async reject(id: string): Promise<SummaryResult<Summary>> {
    return this.resolve(id, 'REJECTED', 'user');
  }

  /** Dismiss a pending summary (soft-hide without changing status). */
  async dismiss(id: string): Promise<SummaryResult<Summary>> {
    const existing = await this.getById(id);
    if (!existing) {
      return { success: false, error: `Summary not found: ${id}` };
    }
    if (existing.dismissedAt) {
      return { success: false, error: `Summary ${id} is already dismissed` };
    }
    if (existing.status !== 'PENDING') {
      return { success: false, error: `Summary ${id} is already ${existing.status}, cannot dismiss` };
    }
    const now = new Date().toISOString();
    if (existing.expiresAt <= now) {
      const expired: Summary = { ...existing, status: 'EXPIRED', resolvedAt: now, resolvedBy: 'timeout' };
      await this.appendSummary(expired);
      return { success: false, error: `Summary ${id} has expired` };
    }
    const updated: Summary = { ...existing, dismissedAt: now };
    await this.appendSummary(updated);
    logger.info('Summary dismissed', { id });
    return { success: true, data: updated };
  }

  /**
   * Supersede a pending summary — marked EXPIRED with resolvedBy='superseded'.
   * Used when a higher-priority summary replaces an older one for the same ticker.
   */
  async supersede(id: string): Promise<SummaryResult<Summary>> {
    const existing = await this.getById(id);
    if (!existing) {
      return { success: false, error: `Summary not found: ${id}` };
    }
    if (existing.status !== 'PENDING') {
      return {
        success: false,
        error: `Summary ${id} is already ${existing.status}, cannot supersede`,
      };
    }

    const updated: Summary = {
      ...existing,
      status: 'EXPIRED',
      resolvedAt: new Date().toISOString(),
      resolvedBy: 'superseded',
    };
    await this.appendSummary(updated);
    logger.info('Summary superseded', { id });
    return { success: true, data: updated };
  }

  /** Get all pending summaries, auto-expiring those past expiresAt. */
  async getPending(): Promise<Summary[]> {
    const all = await this.queryAll();
    const now = new Date().toISOString();
    const pending: Summary[] = [];

    for (const summary of all) {
      if (summary.status !== 'PENDING') continue;
      if (summary.dismissedAt) continue;

      if (summary.expiresAt <= now) {
        // Auto-expire
        const expired: Summary = {
          ...summary,
          status: 'EXPIRED',
          resolvedAt: now,
          resolvedBy: 'timeout',
        };
        await this.appendSummary(expired);
        logger.info('Summary auto-expired', { id: summary.id });
      } else {
        pending.push(summary);
      }
    }

    return pending;
  }

  /** Find a single summary by ID (returns latest version). */
  async getById(id: string): Promise<Summary | null> {
    const files = (await this.listFiles()).reverse(); // newest first

    for (const file of files) {
      const summaries = await this.readFile(file);
      // Search in reverse for the latest entry with this ID
      for (let i = summaries.length - 1; i >= 0; i--) {
        if (summaries[i].id === id) return summaries[i];
      }
    }

    return null;
  }

  /** Query summaries with optional filters. */
  async query(filter: SummaryQueryFilter = {}): Promise<Summary[]> {
    const files = (await this.listFiles(filter.since)).reverse(); // newest first
    const results: Summary[] = [];
    const limit = filter.limit ?? 50;
    const now = new Date().toISOString();

    for (const file of files) {
      if (results.length >= limit) break;

      const summaries = await this.readFile(file);
      for (const summary of [...summaries].reverse()) {
        if (results.length >= limit) break;

        // Resolve effective status (auto-expire check)
        const effectiveStatus = summary.status === 'PENDING' && summary.expiresAt <= now ? 'EXPIRED' : summary.status;

        if (filter.status && effectiveStatus !== filter.status) continue;

        if (filter.dismissed === true && !summary.dismissedAt) continue;
        if (filter.dismissed !== true && summary.dismissedAt) continue;

        // Return with effective status
        if (effectiveStatus !== summary.status) {
          results.push({ ...summary, status: effectiveStatus as SummaryStatus });
        } else {
          results.push(summary);
        }
      }
    }

    return results;
  }

  /**
   * Check if a PENDING (non-expired, non-dismissed) summary already exists for a given triggerId.
   * Used to dedup: if a micro-flow trigger already created a PENDING summary,
   * the macro flow should not create a duplicate.
   */
  async hasPendingTrigger(triggerId: string): Promise<boolean> {
    const all = await this.queryAll();
    const now = new Date().toISOString();
    return all.some((s) => s.triggerId === triggerId && s.status === 'PENDING' && !s.dismissedAt && s.expiresAt > now);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async resolve(
    id: string,
    status: 'APPROVED' | 'REJECTED',
    resolvedBy: string,
  ): Promise<SummaryResult<Summary>> {
    const existing = await this.getById(id);
    if (!existing) {
      return { success: false, error: `Summary not found: ${id}` };
    }

    if (existing.status !== 'PENDING') {
      return {
        success: false,
        error: `Summary ${id} is already ${existing.status}, cannot ${status.toLowerCase()}`,
      };
    }

    // Check expiry
    const now = new Date().toISOString();
    if (existing.expiresAt <= now) {
      const expired: Summary = {
        ...existing,
        status: 'EXPIRED',
        resolvedAt: now,
        resolvedBy: 'timeout',
      };
      await this.appendSummary(expired);
      return { success: false, error: `Summary ${id} has expired` };
    }

    const updated: Summary = {
      ...existing,
      status,
      resolvedAt: now,
      resolvedBy,
    };
    await this.appendSummary(updated);
    logger.info(`Summary ${status.toLowerCase()}`, { id });
    return { success: true, data: updated };
  }

  /** Append a summary line to the appropriate date-partitioned file. */
  private async appendSummary(summary: Summary): Promise<void> {
    await this.ensureDir();
    const dateKey = summary.createdAt.slice(0, 10); // YYYY-MM-DD
    const filePath = join(this.dir, `${dateKey}.jsonl`);
    await appendFile(filePath, JSON.stringify(summary) + '\n');
  }

  /**
   * Read all summaries from all files, deduplicating by ID (last write wins).
   * Used internally for getPending which needs the full picture.
   */
  private async queryAll(): Promise<Summary[]> {
    const files = await this.listFiles();
    const byId = new Map<string, Summary>();

    for (const file of files) {
      const summaries = await this.readFile(file);
      for (const summary of summaries) {
        byId.set(summary.id, summary); // last write wins
      }
    }

    return [...byId.values()];
  }

  private async listFiles(since?: string): Promise<string[]> {
    await this.migrateLegacyActions();
    let dates: string[];
    try {
      const entries = await readdir(this.dir);
      dates = entries
        .filter((f) => f.endsWith('.jsonl'))
        .map((f) => f.replace('.jsonl', ''))
        .sort();
    } catch {
      return [];
    }

    if (since) {
      const sinceDate = since.slice(0, 10);
      dates = dates.filter((d) => d >= sinceDate);
    }

    return dates.map((d) => join(this.dir, `${d}.jsonl`));
  }

  /**
   * Read a JSONL file and deduplicate by ID (last entry wins).
   * This handles the append-only update model: when a summary is
   * approved/rejected/expired, its updated version is appended.
   */
  private async readFile(filePath: string): Promise<Summary[]> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      const byId = new Map<string, Summary>();

      for (let i = 0; i < lines.length; i++) {
        try {
          const parsed = SummarySchema.safeParse(JSON.parse(lines[i]));
          if (parsed.success) {
            byId.set(parsed.data.id, parsed.data); // last write wins
          } else {
            logger.warn(`Skipping invalid summary at ${filePath}:${i}: ${parsed.error.message}`);
          }
        } catch {
          logger.warn(`Skipping malformed summary at ${filePath}:${i}`);
        }
      }

      return [...byId.values()];
    } catch {
      return [];
    }
  }

  private async ensureDir(): Promise<void> {
    if (this.dirCreated) return;
    await mkdir(this.dir, { recursive: true });
    this.dirCreated = true;
  }
}
