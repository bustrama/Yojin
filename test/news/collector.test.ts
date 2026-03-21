import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { NewsArchive } from '../../src/news/archive.js';
import { NewsCollector } from '../../src/news/collector.js';
import type { RssParser } from '../../src/news/collector.js';
import type { Feed } from '../../src/news/types.js';

const testFeed: Feed = {
  id: 'test-feed',
  name: 'Test Feed',
  url: 'https://example.com/rss',
  enabled: true,
};

function makeRssItem(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Test Article',
    link: 'https://example.com/article',
    description: 'A test article about $AAPL',
    isoDate: '2026-03-21T10:00:00.000Z',
    categories: ['technology'],
    ...overrides,
  };
}

describe('NewsCollector', () => {
  let dir: string;
  let archive: NewsArchive;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'yojin-collector-'));
    archive = new NewsArchive({ dir });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('collects articles from a feed', async () => {
    const parser: RssParser = async () => ({
      items: [makeRssItem(), makeRssItem({ title: 'Second Article', isoDate: '2026-03-21T11:00:00.000Z' })],
    });

    const collector = new NewsCollector({ archive, parser });
    const result = await collector.collectFeed(testFeed);

    expect(result.feedId).toBe('test-feed');
    expect(result.fetched).toBe(2);
    expect(result.newArticles).toBe(2);
    expect(result.duplicates).toBe(0);
    expect(result.errors).toHaveLength(0);

    const articles = await archive.query({});
    expect(articles).toHaveLength(2);
  });

  it('deduplicates articles by content hash', async () => {
    const item = makeRssItem();
    const parser: RssParser = async () => ({ items: [item] });

    const collector = new NewsCollector({ archive, parser });

    // First collection
    const result1 = await collector.collectFeed(testFeed);
    expect(result1.newArticles).toBe(1);
    expect(result1.duplicates).toBe(0);

    // Second collection — same item should be deduplicated
    const result2 = await collector.collectFeed(testFeed);
    expect(result2.newArticles).toBe(0);
    expect(result2.duplicates).toBe(1);

    const articles = await archive.query({});
    expect(articles).toHaveLength(1);
  });

  it('extracts tickers from article text', async () => {
    const parser: RssParser = async () => ({
      items: [makeRssItem({ description: '$AAPL and $TSLA mentioned in article' })],
    });

    const collector = new NewsCollector({ archive, parser });
    await collector.collectFeed(testFeed);

    const articles = await archive.query({});
    expect(articles[0].tickers).toContain('AAPL');
    expect(articles[0].tickers).toContain('TSLA');
  });

  it('skips items without a title', async () => {
    const parser: RssParser = async () => ({
      items: [makeRssItem({ title: undefined }), makeRssItem({ title: 'Valid Title' })],
    });

    const collector = new NewsCollector({ archive, parser });
    const result = await collector.collectFeed(testFeed);

    expect(result.newArticles).toBe(1);
  });

  it('skips items without a date', async () => {
    const parser: RssParser = async () => ({
      items: [makeRssItem({ isoDate: undefined, pubDate: undefined })],
    });

    const collector = new NewsCollector({ archive, parser });
    const result = await collector.collectFeed(testFeed);

    expect(result.newArticles).toBe(0);
  });

  it('reports errors on fetch failure', async () => {
    const parser: RssParser = async () => {
      throw new Error('Network timeout');
    };

    const collector = new NewsCollector({ archive, parser });
    const result = await collector.collectFeed(testFeed);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Network timeout');
    expect(result.newArticles).toBe(0);
  });

  it('collects from multiple feeds', async () => {
    const feeds: Feed[] = [
      { id: 'feed-a', name: 'Feed A', url: 'https://a.com/rss', enabled: true },
      { id: 'feed-b', name: 'Feed B', url: 'https://b.com/rss', enabled: true },
      { id: 'feed-c', name: 'Feed C', url: 'https://c.com/rss', enabled: false },
    ];

    const parser: RssParser = async (url) => ({
      items: [
        makeRssItem({
          title: `Article from ${url}`,
          isoDate: `2026-03-21T${url.includes('a') ? '10' : '11'}:00:00.000Z`,
        }),
      ],
    });

    const collector = new NewsCollector({ archive, parser });
    const results = await collector.collectAll(feeds);

    // feed-c is disabled, should be skipped
    expect(results).toHaveLength(2);
    expect(results[0].feedId).toBe('feed-a');
    expect(results[1].feedId).toBe('feed-b');
  });

  it('loads existing hashes on initialization', async () => {
    // Pre-populate archive
    const parser: RssParser = async () => ({
      items: [makeRssItem()],
    });
    const collector1 = new NewsCollector({ archive, parser });
    await collector1.collectFeed(testFeed);

    // Create new collector — should load existing hashes
    const parser2: RssParser = async () => ({
      items: [makeRssItem()],
    });
    const collector2 = new NewsCollector({ archive, parser: parser2 });
    const result = await collector2.collectFeed(testFeed);

    expect(result.duplicates).toBe(1);
    expect(result.newArticles).toBe(0);
  });

  it('handles pubDate fallback when isoDate is missing', async () => {
    const parser: RssParser = async () => ({
      items: [makeRssItem({ isoDate: undefined, pubDate: 'Fri, 21 Mar 2026 10:00:00 GMT' })],
    });

    const collector = new NewsCollector({ archive, parser });
    const result = await collector.collectFeed(testFeed);

    expect(result.newArticles).toBe(1);
    const articles = await archive.query({});
    expect(articles[0].publishedAt).toBe('2026-03-21T10:00:00.000Z');
  });
});
