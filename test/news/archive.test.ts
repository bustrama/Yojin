import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { NewsArchive } from '../../src/news/archive.js';
import type { NewsArticle } from '../../src/news/types.js';

function makeArticle(overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id: 'art-001',
    contentHash: 'hash-001',
    feedId: 'test-feed',
    title: 'Test Article',
    publishedAt: '2026-03-21T10:00:00.000Z',
    ingestedAt: '2026-03-21T10:01:00.000Z',
    tickers: ['AAPL'],
    categories: [],
    ...overrides,
  };
}

describe('NewsArchive', () => {
  let dir: string;
  let archive: NewsArchive;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'yojin-news-'));
    archive = new NewsArchive({ dir });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // Append & query
  // -------------------------------------------------------------------------

  it('appends and queries a single article', async () => {
    const article = makeArticle();
    await archive.append(article);

    const results = await archive.query({});
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('art-001');
  });

  it('appends batch of articles', async () => {
    await archive.appendBatch([
      makeArticle({ id: 'a1', contentHash: 'h1' }),
      makeArticle({ id: 'a2', contentHash: 'h2' }),
      makeArticle({ id: 'a3', contentHash: 'h3' }),
    ]);

    const results = await archive.query({});
    expect(results).toHaveLength(3);
  });

  it('handles empty batch gracefully', async () => {
    await archive.appendBatch([]);
    const results = await archive.query({});
    expect(results).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Date partitioning
  // -------------------------------------------------------------------------

  it('partitions articles by date', async () => {
    await archive.appendBatch([
      makeArticle({ id: 'a1', publishedAt: '2026-03-20T12:00:00.000Z' }),
      makeArticle({ id: 'a2', publishedAt: '2026-03-21T12:00:00.000Z' }),
    ]);

    const dates = await archive.listDates();
    expect(dates).toEqual(['2026-03-20', '2026-03-21']);
  });

  // -------------------------------------------------------------------------
  // Filtering
  // -------------------------------------------------------------------------

  it('filters by ticker', async () => {
    await archive.appendBatch([
      makeArticle({ id: 'a1', tickers: ['AAPL'] }),
      makeArticle({ id: 'a2', tickers: ['TSLA'] }),
      makeArticle({ id: 'a3', tickers: ['AAPL', 'MSFT'] }),
    ]);

    const results = await archive.query({ ticker: 'AAPL' });
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.id).sort()).toEqual(['a1', 'a3']);
  });

  it('filters by feedId', async () => {
    await archive.appendBatch([
      makeArticle({ id: 'a1', feedId: 'reuters' }),
      makeArticle({ id: 'a2', feedId: 'coindesk' }),
    ]);

    const results = await archive.query({ feedId: 'reuters' });
    expect(results).toHaveLength(1);
    expect(results[0].feedId).toBe('reuters');
  });

  it('filters by date range', async () => {
    await archive.appendBatch([
      makeArticle({ id: 'a1', publishedAt: '2026-03-19T12:00:00.000Z' }),
      makeArticle({ id: 'a2', publishedAt: '2026-03-20T12:00:00.000Z' }),
      makeArticle({ id: 'a3', publishedAt: '2026-03-21T12:00:00.000Z' }),
    ]);

    const results = await archive.query({
      since: '2026-03-20T00:00:00.000Z',
      until: '2026-03-20T23:59:59.000Z',
    });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('a2');
  });

  it('filters by search text (case-insensitive)', async () => {
    await archive.appendBatch([
      makeArticle({ id: 'a1', title: 'Fed holds rates steady' }),
      makeArticle({ id: 'a2', title: 'Apple reports record earnings' }),
    ]);

    const results = await archive.query({ search: 'apple' });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('a2');
  });

  it('respects limit parameter', async () => {
    await archive.appendBatch([makeArticle({ id: 'a1' }), makeArticle({ id: 'a2' }), makeArticle({ id: 'a3' })]);

    const results = await archive.query({ limit: 2 });
    expect(results).toHaveLength(2);
  });

  // -------------------------------------------------------------------------
  // Content hash loading
  // -------------------------------------------------------------------------

  it('loads all content hashes for dedup', async () => {
    await archive.appendBatch([makeArticle({ contentHash: 'hash-a' }), makeArticle({ contentHash: 'hash-b' })]);

    const hashes = await archive.loadContentHashes();
    expect(hashes.size).toBe(2);
    expect(hashes.has('hash-a')).toBe(true);
    expect(hashes.has('hash-b')).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  it('returns empty results for empty archive', async () => {
    const results = await archive.query({});
    expect(results).toHaveLength(0);
  });

  it('returns empty dates for empty archive', async () => {
    const dates = await archive.listDates();
    expect(dates).toHaveLength(0);
  });

  it('returns empty hashes for empty archive', async () => {
    const hashes = await archive.loadContentHashes();
    expect(hashes.size).toBe(0);
  });
});
