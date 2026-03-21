/**
 * News archive — append-only JSONL storage with date-partitioned files.
 *
 * Storage layout:
 *   data/news-archive/
 *     2026-03-21.jsonl   ← one file per day
 *     2026-03-22.jsonl
 *
 * Each line is a JSON-serialized NewsArticle.
 */

import { appendFile, mkdir, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import type { NewsArticle } from './types.js';
import { createSubsystemLogger } from '../logging/logger.js';

const logger = createSubsystemLogger('news-archive');

export interface NewsArchiveOptions {
  dir: string; // e.g. 'data/news-archive'
}

export interface NewsQueryFilter {
  /** Filter by ticker symbol (case-sensitive). */
  ticker?: string;
  /** Filter by feed ID. */
  feedId?: string;
  /** ISO date string — only articles on or after this date. */
  since?: string;
  /** ISO date string — only articles on or before this date. */
  until?: string;
  /** Text search in title + summary (case-insensitive). */
  search?: string;
  /** Max articles to return. */
  limit?: number;
}

export class NewsArchive {
  private readonly dir: string;
  private dirCreated = false;

  constructor(options: NewsArchiveOptions) {
    this.dir = options.dir;
  }

  /** Append an article to the date-partitioned archive. */
  async append(article: NewsArticle): Promise<void> {
    await this.ensureDir();
    const dateKey = article.publishedAt.slice(0, 10); // YYYY-MM-DD
    const filePath = join(this.dir, `${dateKey}.jsonl`);
    await appendFile(filePath, JSON.stringify(article) + '\n');
  }

  /** Append multiple articles (batched for same-day writes). */
  async appendBatch(articles: NewsArticle[]): Promise<void> {
    if (articles.length === 0) return;
    await this.ensureDir();

    // Group by date for efficient file I/O
    const byDate = new Map<string, NewsArticle[]>();
    for (const article of articles) {
      const dateKey = article.publishedAt.slice(0, 10);
      const group = byDate.get(dateKey) ?? [];
      group.push(article);
      byDate.set(dateKey, group);
    }

    for (const [dateKey, group] of byDate) {
      const filePath = join(this.dir, `${dateKey}.jsonl`);
      const lines = group.map((a) => JSON.stringify(a)).join('\n') + '\n';
      await appendFile(filePath, lines);
    }
  }

  /** Query articles across date-partitioned files. */
  async query(filter: NewsQueryFilter = {}): Promise<NewsArticle[]> {
    const files = await this.listFiles(filter.since, filter.until);
    const results: NewsArticle[] = [];
    const limit = filter.limit ?? Infinity;

    for (const file of files) {
      if (results.length >= limit) break;

      const articles = await this.readFile(file);
      for (const article of articles) {
        if (results.length >= limit) break;
        if (this.matchesFilter(article, filter)) {
          results.push(article);
        }
      }
    }

    return results;
  }

  /** List all available date keys (YYYY-MM-DD). */
  async listDates(): Promise<string[]> {
    try {
      const entries = await readdir(this.dir);
      return entries
        .filter((f) => f.endsWith('.jsonl'))
        .map((f) => f.replace('.jsonl', ''))
        .sort();
    } catch {
      return [];
    }
  }

  /** Load all content hashes for deduplication. */
  async loadContentHashes(): Promise<Set<string>> {
    const hashes = new Set<string>();
    const files = await this.listFiles();

    for (const file of files) {
      const articles = await this.readFile(file);
      for (const article of articles) {
        hashes.add(article.contentHash);
      }
    }

    return hashes;
  }

  private async listFiles(since?: string, until?: string): Promise<string[]> {
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
    if (until) {
      const untilDate = until.slice(0, 10);
      dates = dates.filter((d) => d <= untilDate);
    }

    return dates.map((d) => join(this.dir, `${d}.jsonl`));
  }

  private async readFile(filePath: string): Promise<NewsArticle[]> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      const articles: NewsArticle[] = [];

      for (let i = 0; i < lines.length; i++) {
        try {
          articles.push(JSON.parse(lines[i]) as NewsArticle);
        } catch {
          logger.warn(`Skipping malformed article at ${filePath}:${i}`);
        }
      }

      return articles;
    } catch {
      return [];
    }
  }

  private matchesFilter(article: NewsArticle, filter: NewsQueryFilter): boolean {
    if (filter.ticker && !article.tickers.includes(filter.ticker)) return false;
    if (filter.feedId && article.feedId !== filter.feedId) return false;
    if (filter.since && article.publishedAt < filter.since) return false;
    if (filter.until && article.publishedAt > filter.until) return false;
    if (filter.search) {
      const term = filter.search.toLowerCase();
      const haystack = `${article.title} ${article.summary ?? ''}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  }

  private async ensureDir(): Promise<void> {
    if (this.dirCreated) return;
    await mkdir(this.dir, { recursive: true });
    this.dirCreated = true;
  }
}
