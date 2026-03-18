import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

import Anthropic from '@anthropic-ai/sdk';

import { toAnthropicMessages } from './anthropic-messages.js';
import type { AIProvider } from './types.js';
import { getTokenManager } from '../auth/token-manager.js';
import type { AgentMessage, ContentBlock, ToolSchema } from '../core/types.js';

const execFileAsync = promisify(execFile);

/** Check whether an error indicates an expired/invalid OAuth token (401). */
function isAuthError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('401') || msg.includes('authentication_error') || msg.includes('OAuth token has expired');
}

/**
 * ClaudeCodeProvider — two auth modes:
 *
 *  - "api_key": Uses @anthropic-ai/sdk directly. Full tool support, multi-turn history.
 *  - "cli":     Spawns `claude -p` subprocess via CLAUDE_CODE_OAUTH_TOKEN. Text-only —
 *               the OAuth token cannot be used against api.anthropic.com directly.
 *
 * Tool calls always require API key mode. CLI mode is text-only.
 */
export class ClaudeCodeProvider implements AIProvider {
  readonly id = 'claude-code';
  readonly name = 'Claude Code';

  private client: Anthropic | null = null;
  private authMode: 'api_key' | 'cli' = 'cli';

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (apiKey) {
      this.authMode = 'api_key';
      this.client = new Anthropic({ apiKey });
    } else if (process.env.CLAUDE_CODE_OAUTH_TOKEN?.trim()) {
      this.authMode = 'cli';
    }
  }

  models(): string[] {
    return ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'];
  }

  async isAvailable(): Promise<boolean> {
    if (this.authMode === 'api_key') return true;
    try {
      await execFileAsync('claude', ['--version'], { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async completeWithTools(params: {
    model: string;
    system?: string;
    messages: AgentMessage[];
    tools?: ToolSchema[];
    maxTokens?: number;
  }): Promise<{
    content: ContentBlock[];
    stopReason: string;
    usage?: { inputTokens: number; outputTokens: number };
  }> {
    if (this.authMode === 'api_key' && this.client) {
      return this.completeWithSdk(this.client, params);
    }

    // CLI mode: strip tools — OAuth tokens don't work against the API directly,
    // so we run text-only via `claude -p` subprocess (same as `pnpm chat`).
    return this.completeWithCli(params);
  }

  private async completeWithSdk(
    client: Anthropic,
    params: {
      model: string;
      system?: string;
      messages: AgentMessage[];
      tools?: ToolSchema[];
      maxTokens?: number;
    },
  ): Promise<{ content: ContentBlock[]; stopReason: string; usage?: { inputTokens: number; outputTokens: number } }> {
    const response = await client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens ?? 4096,
      messages: toAnthropicMessages(params.messages),
      ...(params.system ? { system: params.system } : {}),
      ...(params.tools?.length
        ? {
            tools: params.tools.map((t) => ({
              name: t.name,
              description: t.description,
              input_schema: t.input_schema as Anthropic.Tool.InputSchema,
            })),
          }
        : {}),
    });

    const content: ContentBlock[] = response.content.map((block) => {
      if (block.type === 'text') return { type: 'text' as const, text: block.text };
      if (block.type === 'tool_use')
        return { type: 'tool_use' as const, id: block.id, name: block.name, input: block.input };
      return { type: 'text' as const, text: '' };
    });

    return {
      content,
      stopReason: response.stop_reason ?? 'end_turn',
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
    };
  }

  private async completeWithCli(params: {
    model: string;
    system?: string;
    messages: AgentMessage[];
    maxTokens?: number;
  }): Promise<{ content: ContentBlock[]; stopReason: string; usage?: { inputTokens: number; outputTokens: number } }> {
    const lastUserMsg = [...params.messages].reverse().find((m) => m.role === 'user');
    const promptText =
      typeof lastUserMsg?.content === 'string'
        ? lastUserMsg.content
        : (lastUserMsg?.content
            ?.filter((b) => b.type === 'text')
            .map((b) => (b as { text: string }).text)
            .join('\n') ?? '');

    // Prepend system prompt to user message to avoid CLI arg length issues.
    // The `--system-prompt` flag can't handle large multi-line prompts reliably.
    const fullPrompt = params.system ? `${params.system}\n\n---\n\nUser message:\n${promptText}` : promptText;

    const args = ['-p', fullPrompt, '--output-format', 'json', '--model', params.model];
    if (params.maxTokens) args.push('--max-tokens', String(params.maxTokens));

    const result = await this.execCliWithRefresh(args);

    return {
      content: [{ type: 'text', text: result.result ?? '' }],
      stopReason: 'end_turn',
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }

  /**
   * Execute the claude CLI. On 401 (expired token), attempt a token refresh
   * and retry once.
   */
  private async execCliWithRefresh(
    args: string[],
  ): Promise<{ result?: string; cost_usd?: number; duration_ms?: number; num_turns?: number }> {
    try {
      return await this.execCli(args);
    } catch (error) {
      if (!isAuthError(error)) throw error;

      const tokenManager = getTokenManager();
      if (!tokenManager.hasRefreshToken()) throw error;

      // Refresh the token and retry
      await tokenManager.refresh();
      return this.execCli(args);
    }
  }

  private execCli(
    args: string[],
  ): Promise<{ result?: string; cost_usd?: number; duration_ms?: number; num_turns?: number }> {
    return new Promise((resolve, reject) => {
      const child = spawn('claude', args, {
        timeout: 120_000,
        cwd: '/tmp', // Avoid loading project CLAUDE.md — agent has its own system prompt
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('error', (err) => reject(err));
      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`claude CLI exited with code ${code}: ${stderr || stdout.slice(0, 500)}`));
          return;
        }
        try {
          resolve(
            JSON.parse(stdout) as { result?: string; cost_usd?: number; duration_ms?: number; num_turns?: number },
          );
        } catch {
          reject(new Error(`ClaudeCodeProvider: unexpected CLI output (not JSON): ${stdout.slice(0, 200)}`));
        }
      });

      // Close stdin immediately — we don't pipe input
      child.stdin.end();
    });
  }
}
