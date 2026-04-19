/**
 * PortfolioSnapshotStore — JSONL-backed persistence for portfolio snapshots.
 *
 * Each snapshot is appended as a single JSON line to `snapshots/portfolio.jsonl`
 * (relative to data root ~/.yojin/). The latest snapshot is the current portfolio state.
 * Historical snapshots are preserved for tracking changes over time.
 *
 * File format:
 *   Each line: JSON object with id, positions, totals, metadata, and timestamp.
 */

import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { appendFile, mkdir, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

import type { Platform, PortfolioSnapshot, Position } from '../api/graphql/types.js';
import { createSubsystemLogger } from '../logging/logger.js';

const logger = createSubsystemLogger('snapshot-store');

export interface SaveSnapshotParams {
  positions: Position[];
  platform: Platform;
  existingSnapshot?: PortfolioSnapshot | null;
}

export class PortfolioSnapshotStore {
  private readonly filePath: string;

  constructor(dataRoot: string) {
    this.filePath = join(dataRoot, 'snapshots', 'portfolio.jsonl');
  }

  /**
   * Save positions for a single platform. Replaces ALL existing positions for
   * that platform; positions from other platforms are preserved. Positions with
   * no platform stamp are also cleared — they originated from an earlier save
   * and would otherwise accumulate as stale entries (e.g. sold positions that
   * never get explicitly removed). All incoming positions are stamped with the
   * declared platform. Returns the merged snapshot with recomputed totals.
   */
  async save(params: SaveSnapshotParams): Promise<PortfolioSnapshot> {
    await mkdir(join(this.filePath, '..'), { recursive: true });

    const { positions, platform: rawPlatform } = params;
    const platform = rawPlatform.toUpperCase();

    const stamped = positions.map((p) => ({ ...p, symbol: p.symbol.toUpperCase(), platform }));

    const existing = params.existingSnapshot !== undefined ? params.existingSnapshot : await this.getLatest();
    // Keep only positions from OTHER known platforms. Drop same-platform entries
    // (they're being replaced) and drop platform-less entries (stale from old saves).
    const otherPlatformPositions = (existing?.positions ?? []).filter(
      (p) => p.platform != null && p.platform.toUpperCase() !== platform,
    );
    const merged = [...otherPlatformPositions, ...stamped];

    const totalValue = merged.reduce((sum, p) => sum + p.marketValue, 0);
    const totalCost = merged.reduce((sum, p) => sum + p.costBasis * p.quantity, 0);
    const totalPnl = totalValue - totalCost;

    const snapshot: PortfolioSnapshot = {
      id: `snap-${randomUUID().slice(0, 8)}`,
      positions: merged,
      totalValue,
      totalCost,
      totalPnl,
      totalPnlPercent: totalCost > 0 ? (totalPnl / totalCost) * 100 : 0,
      totalDayChange: 0,
      totalDayChangePercent: 0,
      timestamp: new Date().toISOString(),
      platform: null,
    };

    await appendFile(this.filePath, JSON.stringify(snapshot) + '\n');
    logger.info('Snapshot saved', {
      id: snapshot.id,
      platform,
      positionCount: positions.length,
      totalPositions: merged.length,
    });

    return snapshot;
  }

  /** Retrieve a specific snapshot by ID. Scans the JSONL from the end for efficiency. */
  async getById(snapshotId: string): Promise<PortfolioSnapshot | null> {
    let content: string;
    try {
      content = await readFile(this.filePath, 'utf-8');
    } catch {
      return null;
    }

    const lines = content.trim().split('\n').filter(Boolean);
    // Scan from end — most lookups target recent snapshots
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const snap = JSON.parse(lines[i]) as PortfolioSnapshot;
        if (snap.id === snapshotId) return snap;
      } catch {
        continue;
      }
    }
    return null;
  }

  /** Read the latest snapshot (last line of the JSONL file). Returns null if no snapshots exist. */
  async getLatest(): Promise<PortfolioSnapshot | null> {
    let content: string;
    try {
      content = await readFile(this.filePath, 'utf-8');
    } catch {
      return null;
    }

    const lines = content.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return null;

    try {
      return JSON.parse(lines[lines.length - 1]) as PortfolioSnapshot;
    } catch {
      logger.warn('Failed to parse latest snapshot line');
      return null;
    }
  }

  /**
   * Scan every snapshot and report, for each symbol, the earliest day it appeared — plus the
   * earliest snapshot day overall. Used by history gating to distinguish "new addition" (symbol
   * first-seen > overall-first) from "held since the first snapshot" (equal). Symbols are
   * uppercased for consistent lookup.
   */
  async getFirstSeenMap(): Promise<{
    firstSeenBySymbol: Map<string, string>;
    overallFirstDate: string | null;
  }> {
    let content: string;
    try {
      content = await readFile(this.filePath, 'utf-8');
    } catch {
      return { firstSeenBySymbol: new Map(), overallFirstDate: null };
    }

    const lines = content.trim().split('\n').filter(Boolean);
    const firstSeenBySymbol = new Map<string, string>();
    let overallFirstDate: string | null = null;

    for (const line of lines) {
      let snap: PortfolioSnapshot;
      try {
        snap = JSON.parse(line) as PortfolioSnapshot;
      } catch {
        continue;
      }
      const day = snap.timestamp.slice(0, 10);
      if (overallFirstDate === null || day < overallFirstDate) {
        overallFirstDate = day;
      }
      for (const pos of snap.positions) {
        const symbol = pos.symbol.toUpperCase();
        const existing = firstSeenBySymbol.get(symbol);
        if (!existing || day < existing) {
          firstSeenBySymbol.set(symbol, day);
        }
      }
    }

    return { firstSeenBySymbol, overallFirstDate };
  }

  /** Remove all snapshots (used during onboarding reset). */
  async clearAll(): Promise<void> {
    if (existsSync(this.filePath)) {
      await unlink(this.filePath);
      logger.info('All snapshots cleared');
    }
  }
}
