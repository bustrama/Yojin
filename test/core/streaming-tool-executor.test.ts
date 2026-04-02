import { describe, expect, it, vi } from 'vitest';

import { StreamingToolExecutor } from '../../src/core/streaming-tool-executor.js';
import type { ToolExecutor, ToolResult } from '../../src/core/types.js';

function mockExecutor(results: Record<string, ToolResult>): ToolExecutor {
  return {
    execute: vi.fn(async (name: string) => {
      const result = results[name];
      if (!result) return { content: `Unknown tool: ${name}`, isError: true };
      return result;
    }),
  };
}

function delayedExecutor(delayMs: number): ToolExecutor {
  return {
    execute: vi.fn(
      async (name: string) =>
        new Promise<ToolResult>((resolve) => {
          setTimeout(() => resolve({ content: `Result from ${name}` }), delayMs);
        }),
    ),
  };
}

describe('StreamingToolExecutor', () => {
  it('executes a single tool and returns result', async () => {
    const executor = mockExecutor({ echo: { content: 'hello' } });
    const streaming = new StreamingToolExecutor(executor);

    streaming.addToolCall({ id: '1', name: 'echo', input: {} });
    const results = await streaming.awaitAll();

    expect(results).toHaveLength(1);
    expect(results[0].toolCallId).toBe('1');
    expect(results[0].name).toBe('echo');
    expect(results[0].result.content).toBe('hello');
  });

  it('executes multiple tools in parallel', async () => {
    const executor = delayedExecutor(10);
    const streaming = new StreamingToolExecutor(executor);

    const start = Date.now();
    streaming.addToolCall({ id: '1', name: 'tool_a', input: {} });
    streaming.addToolCall({ id: '2', name: 'tool_b', input: {} });
    streaming.addToolCall({ id: '3', name: 'tool_c', input: {} });

    const results = await streaming.awaitAll();
    const elapsed = Date.now() - start;

    expect(results).toHaveLength(3);
    // Parallel execution: should complete in roughly 1x delay, not 3x
    expect(elapsed).toBeLessThan(100);
  });

  it('handles tool execution errors gracefully', async () => {
    const executor: ToolExecutor = {
      execute: vi.fn(async () => {
        throw new Error('tool crashed');
      }),
    };
    const streaming = new StreamingToolExecutor(executor);

    streaming.addToolCall({ id: '1', name: 'broken', input: {} });
    const results = await streaming.awaitAll();

    expect(results).toHaveLength(1);
    expect(results[0].result.isError).toBe(true);
    expect(results[0].result.content).toContain('tool crashed');
  });

  it('reports pending count correctly', async () => {
    const executor = delayedExecutor(50);
    const streaming = new StreamingToolExecutor(executor);

    expect(streaming.pendingCount).toBe(0);

    streaming.addToolCall({ id: '1', name: 'slow', input: {} });
    expect(streaming.pendingCount).toBe(1);

    await streaming.awaitAll();
    expect(streaming.pendingCount).toBe(0);
  });

  it('getCompletedResults returns only finished tools', async () => {
    const executor = mockExecutor({
      fast: { content: 'done' },
    });
    const streaming = new StreamingToolExecutor(executor);

    streaming.addToolCall({ id: '1', name: 'fast', input: {} });

    // Wait a tick for the promise to resolve
    await new Promise((r) => setTimeout(r, 10));

    const completed = streaming.getCompletedResults();
    expect(completed).toHaveLength(1);
    expect(completed[0].name).toBe('fast');
  });
});
