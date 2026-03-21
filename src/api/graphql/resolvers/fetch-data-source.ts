/**
 * fetchDataSource resolver — triggers a CLI data source to fetch data,
 * parses the output, and ingests results as signals.
 *
 * Uses execFile (not exec) — no shell, no injection risk.
 * Currently supports CLI sources. API/MCP adapters are future work.
 */

import { execFile as nodeExecFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

import { createSubsystemLogger } from '../../../logging/logger.js';
import type { RawSignalInput, SignalIngestor } from '../../../signals/ingestor.js';

const logger = createSubsystemLogger('fetch-data-source');
const runCommand = promisify(nodeExecFile);

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let configPath = 'data/config/data-sources.json';
let ingestor: SignalIngestor | null = null;

export function setFetchDeps(opts: { configPath: string; ingestor: SignalIngestor }): void {
  configPath = opts.configPath;
  ingestor = opts.ingestor;
}

// ---------------------------------------------------------------------------
// Config types (matches data-sources.ts resolver)
// ---------------------------------------------------------------------------

interface DataSourceConfig {
  id: string;
  name: string;
  type: 'CLI' | 'MCP' | 'API';
  capabilities: string[];
  enabled: boolean;
  command?: string;
  args?: string[];
  baseUrl?: string;
}

interface FetchResult {
  success: boolean;
  signalsIngested: number;
  duplicates: number;
  error: string | null;
}

// ---------------------------------------------------------------------------
// RSS XML parser (minimal — no dependencies)
// ---------------------------------------------------------------------------

interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

function parseRssXml(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const description = extractTag(block, 'description');
    const pubDate = extractTag(block, 'pubDate');

    if (title) {
      items.push({
        title: decodeXmlEntities(title),
        link: link ?? '',
        description: decodeXmlEntities(description ?? ''),
        pubDate: pubDate ?? new Date().toISOString(),
      });
    }
  }

  return items;
}

function extractTag(xml: string, tag: string): string | null {
  // Handle CDATA sections
  const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i');
  const cdataMatch = cdataRegex.exec(xml);
  if (cdataMatch) return cdataMatch[1].trim();

  // Handle regular text content
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = regex.exec(xml);
  return m ? m[1].trim() : null;
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, ''); // strip HTML tags from descriptions
}

// ---------------------------------------------------------------------------
// Output → RawSignalInput conversion
// ---------------------------------------------------------------------------

function rssToSignals(items: RssItem[], config: DataSourceConfig): RawSignalInput[] {
  return items.map((item) => ({
    sourceId: config.id,
    sourceName: config.name,
    sourceType: 'RSS' as const,
    reliability: 0.7,
    title: item.title,
    content: item.description || undefined,
    link: item.link || undefined,
    publishedAt: new Date(item.pubDate).toISOString(),
  }));
}

function jsonToSignals(stdout: string, config: DataSourceConfig): RawSignalInput[] {
  const data = JSON.parse(stdout);
  const items = Array.isArray(data) ? data : [data];

  return items
    .filter((item: Record<string, unknown>) => item.title || item.headline || item.name)
    .map((item: Record<string, unknown>) => ({
      sourceId: config.id,
      sourceName: config.name,
      sourceType: 'API' as const,
      reliability: 0.7,
      title: String(item.title ?? item.headline ?? item.name ?? ''),
      content: item.content ? String(item.content) : item.description ? String(item.description) : undefined,
      link: item.url ? String(item.url) : item.link ? String(item.link) : undefined,
      publishedAt: item.publishedAt
        ? String(item.publishedAt)
        : item.date
          ? String(item.date)
          : new Date().toISOString(),
    }));
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

export async function fetchDataSourceResolver(
  _parent: unknown,
  args: { id: string; url?: string },
): Promise<FetchResult> {
  if (!ingestor) {
    return { success: false, signalsIngested: 0, duplicates: 0, error: 'Signal ingestor not initialized' };
  }

  // Load config
  let configs: DataSourceConfig[];
  try {
    const content = await readFile(configPath, 'utf-8');
    configs = JSON.parse(content) as DataSourceConfig[];
  } catch {
    return { success: false, signalsIngested: 0, duplicates: 0, error: 'Failed to load data source configs' };
  }

  const config = configs.find((c) => c.id === args.id);
  if (!config) {
    return { success: false, signalsIngested: 0, duplicates: 0, error: `Data source "${args.id}" not found` };
  }
  if (!config.enabled) {
    return { success: false, signalsIngested: 0, duplicates: 0, error: `Data source "${args.id}" is disabled` };
  }

  if (config.type !== 'CLI') {
    return {
      success: false,
      signalsIngested: 0,
      duplicates: 0,
      error: `Fetch not yet supported for type "${config.type}" — only CLI sources are supported`,
    };
  }

  if (!config.command) {
    return { success: false, signalsIngested: 0, duplicates: 0, error: `Data source "${args.id}" has no command` };
  }

  // Build the command args — append the URL if provided
  const cmdArgs = [...(config.args ?? [])];
  if (args.url) cmdArgs.push(args.url);

  try {
    logger.info(`Fetching from ${config.id}: ${config.command} ${cmdArgs.join(' ')}`);

    // execFile (not exec) — no shell, no injection risk
    const { stdout } = await runCommand(config.command, cmdArgs, {
      timeout: 30_000,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (!stdout.trim()) {
      return { success: false, signalsIngested: 0, duplicates: 0, error: 'Command returned empty output' };
    }

    // Detect format: RSS/XML vs JSON
    const trimmed = stdout.trim();
    let rawSignals: RawSignalInput[];

    if (trimmed.startsWith('<?xml') || trimmed.startsWith('<rss') || trimmed.startsWith('<feed')) {
      rawSignals = rssToSignals(parseRssXml(trimmed), config);
    } else if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      rawSignals = jsonToSignals(trimmed, config);
    } else {
      return {
        success: false,
        signalsIngested: 0,
        duplicates: 0,
        error: 'Unrecognized output format (expected XML or JSON)',
      };
    }

    if (rawSignals.length === 0) {
      return { success: true, signalsIngested: 0, duplicates: 0, error: null };
    }

    const result = await ingestor.ingest(rawSignals);
    logger.info(`Fetch complete for ${config.id}: ${result.ingested} ingested, ${result.duplicates} duplicates`);

    return {
      success: true,
      signalsIngested: result.ingested,
      duplicates: result.duplicates,
      error: result.errors.length > 0 ? result.errors.join('; ') : null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Fetch failed for ${config.id}: ${message}`);
    return { success: false, signalsIngested: 0, duplicates: 0, error: message };
  }
}
