/**
 * News module types — RSS collection, archive, and ticker extraction.
 *
 * Zod schemas are the single source of truth for validation.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Feed configuration
// ---------------------------------------------------------------------------

export const FeedSchema = z.object({
  id: z.string(), // e.g. 'reuters-markets', 'coindesk-rss'
  name: z.string(),
  url: z.string().url(),
  category: z.string().optional(), // e.g. 'macro', 'crypto', 'equities'
  enabled: z.boolean().default(true),
});
export type Feed = z.infer<typeof FeedSchema>;

export const NewsConfigSchema = z.object({
  feeds: z.array(FeedSchema),
  pollIntervalMs: z.number().int().min(10_000).default(300_000), // 5 min default
  maxArticlesPerFeed: z.number().int().min(1).default(50),
  archiveDir: z.string().default('data/news-archive'),
});
export type NewsConfig = z.infer<typeof NewsConfigSchema>;

// ---------------------------------------------------------------------------
// Archived news article
// ---------------------------------------------------------------------------

export const NewsArticleSchema = z.object({
  id: z.string(), // nanoid
  contentHash: z.string(), // SHA-256 for dedup
  feedId: z.string(), // which feed produced this
  title: z.string(),
  link: z.string().url().optional(),
  summary: z.string().optional(),
  content: z.string().optional(), // full content if available
  author: z.string().optional(),
  publishedAt: z.string().datetime(),
  ingestedAt: z.string().datetime(),
  tickers: z.array(z.string()), // extracted ticker symbols
  categories: z.array(z.string()).default([]), // RSS categories/tags
});
export type NewsArticle = z.infer<typeof NewsArticleSchema>;

// ---------------------------------------------------------------------------
// Collector result
// ---------------------------------------------------------------------------

export const CollectorResultSchema = z.object({
  feedId: z.string(),
  fetched: z.number().int().min(0),
  newArticles: z.number().int().min(0),
  duplicates: z.number().int().min(0),
  errors: z.array(z.string()),
});
export type CollectorResult = z.infer<typeof CollectorResultSchema>;
