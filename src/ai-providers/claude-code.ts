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

/** Parse a stream-json event from the claude CLI. */
interface StreamEvent {
  type: string;
  subtype?: string;
  result?: string;
  is_error?: boolean;
  message?: {
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  usage?: {
    input_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    output_tokens?: number;
  };
}

/**
 * ClaudeCodeProvider — two auth modes:
 *
 *  - "api_key": Uses @anthropic-ai/sdk directly. Full tool support, multi-turn history.
 *  - "cli":     Spawns `claude -p` subprocess via CLAUDE_CODE_OAUTH_TOKEN. Text-only —
 *               the OAuth token cannot be used against api.anthropic.com directly.
 *               Supports streaming via `--output-format stream-json`.
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

    // CLI mode: strip tools — OAuth tokens don't work against the API directly.
    return this.completeWithCli(params);
  }

  async streamWithTools(params: {
    model: string;
    system?: string;
    messages: AgentMessage[];
    tools?: ToolSchema[];
    maxTokens?: number;
    onTextDelta?: (text: string) => void;
  }): Promise<{
    content: ContentBlock[];
    stopReason: string;
    usage?: { inputTokens: number; outputTokens: number };
  }> {
    if (this.authMode === 'api_key' && this.client) {
      // SDK mode: use streaming API
      return this.streamWithSdk(this.client, params);
    }

    // CLI mode: use --output-format stream-json for real-time streaming
    return this.streamWithCli(params);
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

  private async streamWithSdk(
    client: Anthropic,
    params: {
      model: string;
      system?: string;
      messages: AgentMessage[];
      tools?: ToolSchema[];
      maxTokens?: number;
      onTextDelta?: (text: string) => void;
    },
  ): Promise<{ content: ContentBlock[]; stopReason: string; usage?: { inputTokens: number; outputTokens: number } }> {
    const stream = client.messages.stream({
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

    stream.on('text', (text) => {
      params.onTextDelta?.(text);
    });

    const response = await stream.finalMessage();

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

  private buildCliPrompt(params: { system?: string; messages: AgentMessage[] }): string {
    // Format full conversation history so the CLI subprocess has context.
    const parts: string[] = [];

    if (params.system) {
      parts.push(params.system);
      parts.push('\n---\n');
    }

    for (const msg of params.messages) {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      const text =
        typeof msg.content === 'string'
          ? msg.content
          : msg.content
              .filter((b) => b.type === 'text')
              .map((b) => (b as { text: string }).text)
              .join('\n');
      if (text) {
        parts.push(`${role}: ${text}`);
      }
    }

    return parts.join('\n\n');
  }

  private async completeWithCli(params: {
    model: string;
    system?: string;
    messages: AgentMessage[];
    maxTokens?: number;
  }): Promise<{ content: ContentBlock[]; stopReason: string; usage?: { inputTokens: number; outputTokens: number } }> {
    const fullPrompt = this.buildCliPrompt(params);
    const args = ['-p', fullPrompt, '--output-format', 'json', '--model', params.model];
    if (params.maxTokens) args.push('--max-tokens', String(params.maxTokens));

    const result = await this.execCliWithRefresh(args);

    return {
      content: [{ type: 'text', text: result.result ?? '' }],
      stopReason: 'end_turn',
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }

  private async streamWithCli(params: {
    model: string;
    system?: string;
    messages: AgentMessage[];
    maxTokens?: number;
    onTextDelta?: (text: string) => void;
  }): Promise<{ content: ContentBlock[]; stopReason: string; usage?: { inputTokens: number; outputTokens: number } }> {
    const fullPrompt = this.buildCliPrompt(params);
    const args = ['-p', fullPrompt, '--output-format', 'stream-json', '--verbose', '--model', params.model];
    if (params.maxTokens) args.push('--max-tokens', String(params.maxTokens));

    return new Promise((resolve, reject) => {
      const child = spawn('claude', args, {
        timeout: 120_000,
        cwd: '/tmp',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let fullText = '';
      let lastSeenText = '';
      let buffer = '';
      let stderr = '';
      const usage = { inputTokens: 0, outputTokens: 0 };

      child.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();

        // Process complete JSONL lines
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as StreamEvent;

            if (event.type === 'assistant' && event.message?.content) {
              // Extract new text from the assistant message content
              for (const block of event.message.content) {
                if (block.type === 'text' && block.text) {
                  // The assistant event contains the full text so far, emit only the delta
                  const newText = block.text;
                  if (newText.length > lastSeenText.length) {
                    const delta = newText.slice(lastSeenText.length);
                    lastSeenText = newText;
                    fullText = newText;
                    params.onTextDelta?.(delta);
                  }
                }
              }
            } else if (event.type === 'result') {
              // Final result — use its text as the authoritative response
              if (event.result) fullText = event.result;
              if (event.usage) {
                usage.inputTokens = (event.usage.input_tokens ?? 0) + (event.usage.cache_read_input_tokens ?? 0);
                usage.outputTokens = event.usage.output_tokens ?? 0;
              }
            }
          } catch {
            // Skip unparseable lines
          }
        }
      });

      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('error', (err) => reject(err));
      child.on('close', (code) => {
        // Process any remaining buffer
        if (buffer.trim()) {
          try {
            const event = JSON.parse(buffer) as StreamEvent;
            if (event.type === 'result' && event.result) {
              fullText = event.result;
            }
          } catch {
            // Ignore
          }
        }

        if (code !== 0) {
          reject(new Error(`claude CLI exited with code ${code}: ${stderr || fullText.slice(0, 500)}`));
          return;
        }

        resolve({
          content: [{ type: 'text', text: fullText }],
          stopReason: 'end_turn',
          usage,
        });
      });

      child.stdin.end();
    });
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
        cwd: '/tmp',
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

      child.stdin.end();
    });
  }
}
