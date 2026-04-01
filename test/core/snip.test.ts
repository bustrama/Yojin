import { describe, expect, it } from 'vitest';

import { snipToolResults } from '../../src/core/snip.js';
import { TokenBudget } from '../../src/core/token-budget.js';
import type { AgentMessage } from '../../src/core/types.js';

function makeToolResultMessage(content: string): AgentMessage {
  return {
    role: 'user',
    content: [
      {
        type: 'tool_result',
        tool_use_id: 'test-id',
        content,
      },
    ],
  };
}

function makeTextMessage(role: 'user' | 'assistant', text: string): AgentMessage {
  return { role, content: text };
}

function buildConversation(turnCount: number, toolResultSize: number): AgentMessage[] {
  const messages: AgentMessage[] = [];
  for (let i = 0; i < turnCount; i++) {
    messages.push(makeTextMessage('user', `Question ${i}`));
    messages.push({
      role: 'assistant',
      content: [{ type: 'tool_use', id: `tool-${i}`, name: 'fetch_data', input: {} }],
    });
    messages.push(makeToolResultMessage('x'.repeat(toolResultSize)));
    messages.push(makeTextMessage('assistant', `Answer ${i}`));
  }
  return messages;
}

describe('snipToolResults', () => {
  it('does not snip when under threshold', () => {
    // Small conversation — well under 70% of 200k context
    const messages = buildConversation(3, 100);
    const budget = new TokenBudget({ contextWindow: 200_000 });

    const result = snipToolResults(messages, budget, { preserveRecentTurns: 2 });

    expect(result.snipped).toBe(0);
    expect(result.messages).toBe(messages); // Same reference — no copy
  });

  it('snips old tool results when over threshold', () => {
    // Large tool results that push us over 70% threshold
    // 10 turns * 40k chars each ≈ 400k chars ≈ ~115k tokens (at 4 chars/token * 1.15 safety)
    // That exceeds 70% of 200k = 140k threshold
    const messages = buildConversation(10, 40_000);
    const budget = new TokenBudget({ contextWindow: 200_000 });

    const result = snipToolResults(messages, budget, { preserveRecentTurns: 3 });

    expect(result.snipped).toBeGreaterThan(0);
    // Recent 3 turns should be preserved
    // Old tool results should be snipped
    const snippedContent = result.messages
      .filter((m) => Array.isArray(m.content))
      .flatMap((m) => m.content as Array<{ type: string; content?: string }>)
      .filter((b) => b.type === 'tool_result' && b.content?.includes('snipped'));
    expect(snippedContent.length).toBeGreaterThan(0);
  });

  it('preserves recent turns unsnipped', () => {
    const messages = buildConversation(10, 40_000);
    const budget = new TokenBudget({ contextWindow: 200_000 });

    const result = snipToolResults(messages, budget, { preserveRecentTurns: 3 });

    // Last 3 turns (12 messages each = 36 messages from end)
    // Check that the last tool result is NOT snipped
    const lastToolResult = [...result.messages]
      .reverse()
      .find((m) => Array.isArray(m.content) && m.content.some((b: { type: string }) => b.type === 'tool_result'));
    if (lastToolResult && Array.isArray(lastToolResult.content)) {
      const toolBlock = lastToolResult.content.find((b: { type: string }) => b.type === 'tool_result') as
        | { content: string }
        | undefined;
      expect(toolBlock?.content).not.toContain('snipped');
    }
  });

  it('does not snip small tool results', () => {
    // Tool results under 500 chars should be preserved
    const messages = buildConversation(10, 100);
    // Use a tiny context window to force the threshold
    const budget = new TokenBudget({ contextWindow: 1_000 });

    const result = snipToolResults(messages, budget, { preserveRecentTurns: 2 });

    // Even though we're over threshold, results are too small to snip
    expect(result.snipped).toBe(0);
  });

  it('returns original messages when conversation is too short', () => {
    const messages = [makeTextMessage('user', 'hello')];
    const budget = new TokenBudget({ contextWindow: 1_000 });

    const result = snipToolResults(messages, budget, { preserveRecentTurns: 5 });

    expect(result.snipped).toBe(0);
  });
});
