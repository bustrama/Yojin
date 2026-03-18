import type { LanguageModel, ToolSet } from 'ai';

import type { AIProvider } from './types.js';
import type { AgentMessage, ContentBlock, ToolSchema } from '../core/types.js';

export class VercelAIProvider implements AIProvider {
  readonly id = 'vercel-ai';
  readonly name = 'Vercel AI SDK';

  models(): string[] {
    return ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-4-5-20251001', 'gpt-4o', 'gpt-4o-mini'];
  }

  async isAvailable(): Promise<boolean> {
    return !!(process.env.ANTHROPIC_API_KEY ?? process.env.OPENAI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY);
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
    const { generateText, jsonSchema } = await import('ai');
    const modelInstance = await this.resolveModel(params.model);

    const messages = params.messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    }));

    const tools: ToolSet = {};
    for (const t of params.tools ?? []) {
      tools[t.name] = {
        description: t.description,
        inputSchema: jsonSchema(t.input_schema),
      };
    }

    const result = await generateText({
      model: modelInstance,
      system: params.system,
      messages,
      tools: Object.keys(tools).length > 0 ? tools : undefined,
      maxOutputTokens: params.maxTokens,
    });

    const content: ContentBlock[] = [];
    if (result.text) {
      content.push({ type: 'text', text: result.text });
    }
    for (const call of result.toolCalls) {
      content.push({
        type: 'tool_use',
        id: call.toolCallId,
        name: call.toolName,
        input: call.input,
      });
    }

    return {
      content,
      stopReason: result.finishReason === 'tool-calls' ? 'tool_use' : 'end_turn',
      usage: result.usage
        ? { inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0 }
        : undefined,
    };
  }

  private async resolveModel(modelId: string): Promise<LanguageModel> {
    if (modelId.startsWith('claude')) {
      const { anthropic } = await import('@ai-sdk/anthropic');
      return anthropic(modelId);
    }
    if (modelId.startsWith('gpt')) {
      const { openai } = await import('@ai-sdk/openai');
      return openai(modelId);
    }
    // Default to Anthropic for unknown model IDs
    const { anthropic } = await import('@ai-sdk/anthropic');
    return anthropic(modelId);
  }
}
