/**
 * News module — RSS collection, archive, ticker extraction, and agent tools.
 */

export { NewsArchive } from './archive.js';
export type { NewsArchiveOptions, NewsQueryFilter } from './archive.js';

export { NewsCollector } from './collector.js';
export type { CollectorOptions, RssFeed, RssItem, RssParser } from './collector.js';

export { extractTickers } from './ticker-extractor.js';
export type { SymbolResolver } from './ticker-extractor.js';

export { createNewsTools } from './tools.js';
export type { NewsToolsOptions } from './tools.js';

export { CollectorResultSchema, FeedSchema, NewsArticleSchema, NewsConfigSchema } from './types.js';
export type { CollectorResult, Feed, NewsArticle, NewsConfig } from './types.js';
