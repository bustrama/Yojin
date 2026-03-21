/**
 * RSS feed collector — fetches, parses, deduplicates, and archives news articles.
 *
 * Uses content-hash dedup (SHA-256 of title + source + publishedAt) to avoid
 * storing duplicates across feeds and collection runs.
 */

import { createHash, randomUUID } from 'node:crypto';

import type { NewsArchive } from './archive.js';
import { extractTickers } from './ticker-extractor.js';
import type { SymbolResolver } from './ticker-extractor.js';
import type { CollectorResult, Feed, NewsArticle } from './types.js';
import { createSubsystemLogger } from '../logging/logger.js';

const logger = createSubsystemLogger('news-collector');

/** Minimal RSS item shape — what we expect from the XML parser. */
export interface RssItem {
  title?: string;
  link?: string;
  description?: string;
  content?: string;
  author?: string;
  pubDate?: string;
  isoDate?: string;
  categories?: string[];
}

/** Minimal RSS feed shape — what we expect from the XML parser. */
export interface RssFeed {
  items: RssItem[];
}

/**
 * Parse function signature — abstracts the RSS parsing library.
 * Accepts a URL, returns parsed feed items.
 */
export type RssParser = (url: string) => Promise<RssFeed>;

export interface CollectorOptions {
  archive: NewsArchive;
  parser: RssParser;
  symbolResolver?: SymbolResolver;
}

export class NewsCollector {
  private readonly archive: NewsArchive;
  private readonly parser: RssParser;
  private readonly symbolResolver?: SymbolResolver;
  private knownHashes = new Set<string>();
  private initialized = false;

  constructor(options: CollectorOptions) {
    this.archive = options.archive;
    this.parser = options.parser;
    this.symbolResolver = options.symbolResolver;
  }

  /** Load existing content hashes from archive for dedup. */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.knownHashes = await this.archive.loadContentHashes();
    logger.info(`Loaded ${this.knownHashes.size} existing content hashes`);
    this.initialized = true;
  }

  /** Collect articles from a single feed. */
  async collectFeed(feed: Feed): Promise<CollectorResult> {
    await this.initialize();

    const result: CollectorResult = {
      feedId: feed.id,
      fetched: 0,
      newArticles: 0,
      duplicates: 0,
      errors: [],
    };

    let rssFeed: RssFeed;
    try {
      rssFeed = await this.parser(feed.url);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to fetch ${feed.url}: ${msg}`);
      logger.error('RSS fetch failed', { feedId: feed.id, error: msg });
      return result;
    }

    result.fetched = rssFeed.items.length;
    const newArticles: NewsArticle[] = [];

    for (const item of rssFeed.items) {
      try {
        const article = this.toArticle(item, feed);
        if (!article) continue; // Missing required fields

        if (this.knownHashes.has(article.contentHash)) {
          result.duplicates++;
          continue;
        }

        this.knownHashes.add(article.contentHash);
        newArticles.push(article);
        result.newArticles++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        result.errors.push(`Failed to parse item: ${msg}`);
      }
    }

    if (newArticles.length > 0) {
      await this.archive.appendBatch(newArticles);
      logger.info(`Archived ${newArticles.length} new articles from ${feed.id}`);
    }

    return result;
  }

  /** Collect from multiple feeds. */
  async collectAll(feeds: Feed[]): Promise<CollectorResult[]> {
    const enabledFeeds = feeds.filter((f) => f.enabled);
    const results: CollectorResult[] = [];

    for (const feed of enabledFeeds) {
      const result = await this.collectFeed(feed);
      results.push(result);
    }

    return results;
  }

  /** Convert an RSS item to a NewsArticle. Returns null if missing required fields. */
  private toArticle(item: RssItem, feed: Feed): NewsArticle | null {
    const title = item.title?.trim();
    if (!title) return null;

    const publishedAt = item.isoDate ?? item.pubDate;
    if (!publishedAt) return null;

    // Normalize to ISO-8601
    const pubDate = new Date(publishedAt);
    if (isNaN(pubDate.getTime())) return null;
    const publishedIso = pubDate.toISOString();

    const contentHash = this.computeHash(title, feed.id, publishedIso);
    const textForTickers = `${title} ${item.description ?? ''} ${item.content ?? ''}`;

    return {
      id: randomUUID().slice(0, 12),
      contentHash,
      feedId: feed.id,
      title,
      link: item.link,
      summary: item.description?.trim(),
      content: item.content?.trim(),
      author: item.author?.trim(),
      publishedAt: publishedIso,
      ingestedAt: new Date().toISOString(),
      tickers: extractTickers(textForTickers, this.symbolResolver),
      categories: item.categories ?? [],
    };
  }

  /** SHA-256 content hash for dedup. */
  private computeHash(title: string, feedId: string, publishedAt: string): string {
    return createHash('sha256').update(`${title}|${feedId}|${publishedAt}`).digest('hex');
  }
}
