/**
 * Web channel plugin implementation.
 *
 * Serves the GraphQL API, chat endpoints, and SSE streaming over Hono.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve, type ServerType } from '@hono/node-server';
import { streamSSE } from 'hono/streaming';
import type {
  ChannelPlugin,
  ChannelMessagingAdapter,
  ChannelAuthAdapter,
  ChannelSetupAdapter,
  ChannelCapabilities,
  IncomingMessage,
  OutgoingMessage,
} from '../../../src/plugins/types.js';
import { mountGraphQL } from '../../../src/api/graphql/server.js';

type MessageHandler = (msg: IncomingMessage) => Promise<void>;

export function buildWebChannel(): ChannelPlugin {
  let server: ServerType | undefined;
  const app = new Hono();
  const messageHandlers: MessageHandler[] = [];

  // Track pending SSE responses by thread ID
  const pendingResponses = new Map<string, (text: string) => void>();

  const messagingAdapter: ChannelMessagingAdapter = {
    async sendMessage(msg: OutgoingMessage): Promise<void> {
      // Resolve pending SSE or chat response
      const threadId = msg.threadId ?? msg.channelId;
      const resolve = pendingResponses.get(threadId);
      if (resolve) {
        resolve(msg.text);
        pendingResponses.delete(threadId);
      }
    },
    onMessage(handler: MessageHandler): void {
      messageHandlers.push(handler);
    },
  };

  const authAdapter: ChannelAuthAdapter = {
    async validateToken(token: string): Promise<boolean> {
      // Simple bearer token validation — replaced by real auth later
      return token.length > 0;
    },
    getScopes() {
      return ['chat:read', 'chat:write', 'portfolio:read', 'alerts:manage'];
    },
  };

  const setupAdapter: ChannelSetupAdapter = {
    async setup(config: Record<string, unknown>): Promise<void> {
      const options = config.options as Record<string, string | number> | undefined;
      const port = Number(options?.port ?? process.env.YOJIN_PORT ?? 3000);

      // CORS for local development
      app.use(
        '*',
        cors({
          origin: ['http://localhost:5173', 'http://localhost:3000'],
          credentials: true,
        }),
      );

      // Health check
      app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

      // Mount GraphQL API
      mountGraphQL(app);

      // Chat endpoint — POST message, get response
      app.post('/api/chat', async (c) => {
        const body = await c.req.json<{ message: string; threadId?: string }>();
        const threadId = body.threadId ?? `web-${Date.now()}`;

        const incoming: IncomingMessage = {
          channelId: 'web',
          threadId,
          userId: 'web-user',
          text: body.message,
          timestamp: new Date().toISOString(),
        };

        // Create a promise that resolves when the agent responds
        const responsePromise = new Promise<string>((resolve) => {
          pendingResponses.set(threadId, resolve);
        });

        // Dispatch to agent
        for (const handler of messageHandlers) {
          await handler(incoming);
        }

        const response = await responsePromise;
        return c.json({ threadId, response });
      });

      // SSE streaming endpoint
      app.get('/api/chat/stream', (c) => {
        const threadId = c.req.query('threadId') ?? `web-stream-${Date.now()}`;
        const message = c.req.query('message');

        if (!message) {
          return c.json({ error: 'message query parameter required' }, 400);
        }

        return streamSSE(c, async (stream) => {
          const incoming: IncomingMessage = {
            channelId: 'web',
            threadId,
            userId: 'web-user',
            text: message,
            timestamp: new Date().toISOString(),
          };

          // Set up response capture
          const responsePromise = new Promise<string>((resolve) => {
            pendingResponses.set(threadId, resolve);
          });

          // Dispatch to agent
          for (const handler of messageHandlers) {
            await handler(incoming);
          }

          const response = await responsePromise;

          await stream.writeSSE({
            event: 'message',
            data: JSON.stringify({ threadId, response }),
          });

          await stream.writeSSE({ event: 'done', data: '' });
        });
      });

      server = serve({ fetch: app.fetch, port }, () => {
        console.log(`Web channel listening on http://localhost:${port}`);
        console.log(`GraphQL playground: http://localhost:${port}/graphql`);
      });
    },

    async teardown(): Promise<void> {
      if (server) {
        server.close();
      }
    },
  };

  const capabilities: ChannelCapabilities = {
    supportsThreading: true,
    supportsReactions: false,
    supportsFiles: false,
    supportsEditing: false,
  };

  return {
    id: 'web',
    name: 'Web',
    description: 'Web UI channel — GraphQL API + chat + SSE streaming',
    aliases: ['http', 'api'],
    messagingAdapter,
    authAdapter,
    setupAdapter,
    capabilities,

    async initialize(config: Record<string, unknown>): Promise<void> {
      const channels = (config as Record<string, unknown>).channels as Array<{
        id: string;
        enabled: boolean;
        options?: Record<string, unknown>;
      }>;
      const webConfig = channels?.find((c) => c.id === 'web');

      if (!webConfig?.enabled) {
        console.log('Web channel is disabled, skipping setup');
        return;
      }

      await setupAdapter.setup({ options: webConfig.options ?? {} });
    },

    async shutdown(): Promise<void> {
      await setupAdapter.teardown?.();
    },
  };
}
