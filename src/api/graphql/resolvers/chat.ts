/**
 * Chat resolvers — sendMessage mutation + onChatMessage subscription.
 *
 * Streams agent responses via GraphQL subscriptions (SSE) using pubsub.
 * AgentRuntime is injected at startup via setChatAgentRuntime().
 */

import type { AgentRuntime } from '../../../core/agent-runtime.js';
import type { AgentLoopEvent } from '../../../core/types.js';
import { pubsub } from '../pubsub.js';
import type { ChatEvent } from '../types.js';

let runtime: AgentRuntime | undefined;

/** Inject the AgentRuntime — called once from Gateway at startup. */
export function setChatAgentRuntime(agentRuntime: AgentRuntime): void {
  runtime = agentRuntime;
}

// ---------------------------------------------------------------------------
// Mutation: sendMessage
// ---------------------------------------------------------------------------

export function sendMessageMutation(
  _parent: unknown,
  args: { threadId: string; message: string },
): { threadId: string; messageId: string } {
  if (!runtime) {
    throw new Error('Chat runtime not initialized');
  }

  const { threadId, message } = args;
  const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Fire-and-forget: run agent in background, stream events via pubsub
  void (async () => {
    try {
      // runtime is guaranteed non-null — checked above before the void IIFE
      await (runtime as AgentRuntime).handleMessage({
        message,
        channelId: 'web',
        userId: 'web-user',
        threadId,
        onEvent: (event: AgentLoopEvent) => {
          if (event.type === 'text_delta') {
            const chatEvent: ChatEvent = {
              type: 'TEXT_DELTA',
              threadId,
              delta: event.text,
            };
            pubsub.publish(`chat:${threadId}`, chatEvent);
          } else if (event.type === 'done') {
            const chatEvent: ChatEvent = {
              type: 'MESSAGE_COMPLETE',
              threadId,
              messageId,
              content: event.text,
            };
            pubsub.publish(`chat:${threadId}`, chatEvent);
          }
        },
      });
    } catch (err) {
      const chatEvent: ChatEvent = {
        type: 'ERROR',
        threadId,
        error: err instanceof Error ? err.message : String(err),
      };
      pubsub.publish(`chat:${threadId}`, chatEvent);
    }
  })();

  return { threadId, messageId };
}

// ---------------------------------------------------------------------------
// Subscription: onChatMessage
// ---------------------------------------------------------------------------

export const onChatMessageSubscription = {
  subscribe: (_parent: unknown, args: { threadId: string }) => {
    return pubsub.subscribe(`chat:${args.threadId}`);
  },
  resolve: (payload: ChatEvent) => payload,
};
