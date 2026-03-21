/**
 * News agent tools — glob_news, grep_news, read_news.
 *
 * These are registered with ToolRegistry and scoped to the Research Analyst agent.
 * They search the JSONL news archive, not the live RSS feeds.
 */

import { z } from 'zod';

import type { NewsArchive } from './archive.js';
import type { NewsArticle } from './types.js';
import type { ToolDefinition, ToolResult } from '../core/types.js';

export interface NewsToolsOptions {
  archive: NewsArchive;
}

export function createNewsTools(options: NewsToolsOptions): ToolDefinition[] {
  const { archive } = options;

  const globNews: ToolDefinition = {
    name: 'glob_news',
    description:
      'List available news dates and article counts. Use this to discover what ' +
      'news data is available before drilling into specific articles.',
    parameters: z.object({}),
    async execute(): Promise<ToolResult> {
      const dates = await archive.listDates();
      if (dates.length === 0) {
        return { content: 'No news articles in archive.' };
      }
      return {
        content: `Available news dates (${dates.length}):\n${dates.join('\n')}`,
      };
    },
  };

  const grepNews: ToolDefinition = {
    name: 'grep_news',
    description:
      'Search news articles by ticker, date range, feed, or text. ' +
      'Returns matching article summaries (id, title, tickers, date).',
    parameters: z.object({
      ticker: z.string().optional().describe('Filter by ticker symbol (e.g. AAPL)'),
      feedId: z.string().optional().describe('Filter by feed ID'),
      since: z.string().optional().describe('ISO date — articles on or after this date'),
      until: z.string().optional().describe('ISO date — articles on or before this date'),
      search: z.string().optional().describe('Text search in title and summary'),
      limit: z.number().int().min(1).max(100).default(20).describe('Max results'),
    }),
    async execute(params: {
      ticker?: string;
      feedId?: string;
      since?: string;
      until?: string;
      search?: string;
      limit: number;
    }): Promise<ToolResult> {
      const articles = await archive.query({
        ticker: params.ticker,
        feedId: params.feedId,
        since: params.since,
        until: params.until,
        search: params.search,
        limit: params.limit,
      });

      if (articles.length === 0) {
        return { content: 'No articles match your search.' };
      }

      const lines = articles.map((a) => formatArticleSummary(a));
      return {
        content: `Found ${articles.length} article(s):\n\n${lines.join('\n\n')}`,
      };
    },
  };

  const readNews: ToolDefinition = {
    name: 'read_news',
    description:
      'Read the full content of a specific news article by ID. ' + 'Use grep_news first to find article IDs.',
    parameters: z.object({
      id: z.string().describe('Article ID from grep_news results'),
      since: z.string().optional().describe('Narrow the date range to search (ISO date)'),
      until: z.string().optional().describe('Narrow the date range to search (ISO date)'),
    }),
    async execute(params: { id: string; since?: string; until?: string }): Promise<ToolResult> {
      // Search for the article by ID
      const articles = await archive.query({
        since: params.since,
        until: params.until,
      });

      const article = articles.find((a) => a.id === params.id);
      if (!article) {
        return { content: `Article not found: ${params.id}`, isError: true };
      }

      return {
        content: formatArticleFull(article),
      };
    },
  };

  return [globNews, grepNews, readNews];
}

function formatArticleSummary(a: NewsArticle): string {
  const tickers = a.tickers.length > 0 ? ` [${a.tickers.join(', ')}]` : '';
  return `**${a.id}** — ${a.title}${tickers}\n  ${a.publishedAt} | ${a.feedId}`;
}

function formatArticleFull(a: NewsArticle): string {
  const parts = [
    `# ${a.title}`,
    `ID: ${a.id}`,
    `Feed: ${a.feedId}`,
    `Published: ${a.publishedAt}`,
    `Ingested: ${a.ingestedAt}`,
    a.tickers.length > 0 ? `Tickers: ${a.tickers.join(', ')}` : null,
    a.author ? `Author: ${a.author}` : null,
    a.link ? `Link: ${a.link}` : null,
    a.categories.length > 0 ? `Categories: ${a.categories.join(', ')}` : null,
    '',
    a.content ?? a.summary ?? '(no content)',
  ];
  return parts.filter((p) => p !== null).join('\n');
}
