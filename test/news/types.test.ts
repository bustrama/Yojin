import { describe, expect, it } from 'vitest';

import { CollectorResultSchema, FeedSchema, NewsArticleSchema, NewsConfigSchema } from '../../src/news/index.js';

describe('FeedSchema', () => {
  it('parses a valid feed', () => {
    const result = FeedSchema.parse({
      id: 'reuters',
      name: 'Reuters',
      url: 'https://reuters.com/rss',
      category: 'markets',
    });
    expect(result.id).toBe('reuters');
    expect(result.enabled).toBe(true); // default
  });

  it('rejects invalid URL', () => {
    expect(() =>
      FeedSchema.parse({
        id: 'bad',
        name: 'Bad Feed',
        url: 'not-a-url',
      }),
    ).toThrow();
  });

  it('accepts disabled feed', () => {
    const result = FeedSchema.parse({
      id: 'test',
      name: 'Test',
      url: 'https://test.com/rss',
      enabled: false,
    });
    expect(result.enabled).toBe(false);
  });
});

describe('NewsConfigSchema', () => {
  it('parses config with defaults', () => {
    const result = NewsConfigSchema.parse({
      feeds: [{ id: 'test', name: 'Test', url: 'https://test.com/rss' }],
    });
    expect(result.pollIntervalMs).toBe(300_000);
    expect(result.maxArticlesPerFeed).toBe(50);
    expect(result.archiveDir).toBe('data/news-archive');
  });

  it('rejects poll interval below 10s', () => {
    expect(() =>
      NewsConfigSchema.parse({
        feeds: [],
        pollIntervalMs: 5000,
      }),
    ).toThrow();
  });
});

describe('NewsArticleSchema', () => {
  const validArticle = {
    id: 'art-001',
    contentHash: 'abc123',
    feedId: 'reuters',
    title: 'Fed holds rates',
    publishedAt: '2026-03-21T10:00:00.000Z',
    ingestedAt: '2026-03-21T10:01:00.000Z',
    tickers: ['SPY'],
  };

  it('parses a valid article', () => {
    const result = NewsArticleSchema.parse(validArticle);
    expect(result.title).toBe('Fed holds rates');
    expect(result.categories).toEqual([]); // default
  });

  it('parses article with all optional fields', () => {
    const result = NewsArticleSchema.parse({
      ...validArticle,
      link: 'https://reuters.com/article',
      summary: 'The Fed kept rates unchanged',
      content: 'Full article content...',
      author: 'John Doe',
      categories: ['macro', 'fed'],
    });
    expect(result.author).toBe('John Doe');
    expect(result.categories).toEqual(['macro', 'fed']);
  });

  it('rejects invalid publishedAt format', () => {
    expect(() =>
      NewsArticleSchema.parse({
        ...validArticle,
        publishedAt: 'not-a-date',
      }),
    ).toThrow();
  });

  it('rejects missing required fields', () => {
    expect(() => NewsArticleSchema.parse({ id: 'art-001' })).toThrow();
  });
});

describe('CollectorResultSchema', () => {
  it('parses a valid result', () => {
    const result = CollectorResultSchema.parse({
      feedId: 'reuters',
      fetched: 10,
      newArticles: 8,
      duplicates: 2,
      errors: [],
    });
    expect(result.newArticles).toBe(8);
  });

  it('rejects negative counts', () => {
    expect(() =>
      CollectorResultSchema.parse({
        feedId: 'reuters',
        fetched: -1,
        newArticles: 0,
        duplicates: 0,
        errors: [],
      }),
    ).toThrow();
  });
});
