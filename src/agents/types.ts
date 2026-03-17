/**
 * Agent types — represents an AI agent that processes conversations.
 */

import type { AgentMessage } from '../core/types.js';

export interface AgentContext {
  providerId: string;
  model: string;
  channelId: string;
  threadId?: string;
  userId: string;
}

export interface Agent {
  id: string;
  name: string;
  systemPrompt?: string;

  /** Process a conversation and return a response. */
  process(context: AgentContext, history: AgentMessage[], userMessage: string): Promise<string>;
}
