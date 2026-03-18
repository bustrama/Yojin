import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { AIProvider } from './types.js';
import type { AgentMessage, ContentBlock, ToolSchema } from '../core/types.js';

const execFileAsync = promisify(execFile);

export class ClaudeCodeProvider implements AIProvider {
  readonly id = 'claude-code';
  readonly name = 'Claude Code CLI';

  models(): string[] {
    return ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-4-5-20251001'];
  }

  async isAvailable(): Promise<boolean> {
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
    const lastUserMsg = [...params.messages].reverse().find((m) => m.role === 'user');
    const promptText =
      typeof lastUserMsg?.content === 'string'
        ? lastUserMsg.content
        : (lastUserMsg?.content
            ?.filter((b) => b.type === 'text')
            .map((b) => (b as { text: string }).text)
            .join('\n') ?? '');

    const args = ['-p', promptText, '--output-format', 'json', '--model', params.model];

    if (params.system) {
      args.push('--system-prompt', params.system);
    }

    if (params.maxTokens) {
      args.push('--max-tokens', String(params.maxTokens));
    }

    const { stdout } = await execFileAsync('claude', args, {
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    });

    const result = JSON.parse(stdout) as {
      result?: string;
      cost_usd?: number;
      duration_ms?: number;
      num_turns?: number;
    };

    return {
      content: [{ type: 'text', text: result.result ?? '' }],
      stopReason: 'end_turn',
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }
}
