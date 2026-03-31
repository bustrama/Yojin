import * as fsp from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildWhatsAppChannel } from '../../../channels/whatsapp/src/channel.js';
import * as sessionModule from '../../../channels/whatsapp/src/session.js';

vi.mock('node:fs/promises', () => ({
  access: vi.fn().mockResolvedValue(undefined),
  chmod: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(JSON.stringify({ me: { id: '1234567890:5@s.whatsapp.net' } })),
}));

vi.mock('@whiskeysockets/baileys', () => ({
  makeWASocket: vi.fn(),
  useMultiFileAuthState: vi.fn(),
  makeCacheableSignalKeyStore: vi.fn(),
  fetchLatestBaileysVersion: vi.fn(),
  DisconnectReason: { loggedOut: 401, restartRequired: 515 },
}));

vi.mock('../../../src/logging/logger.js', () => ({
  createSubsystemLogger: () => ({
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  }),
}));

vi.mock('../../../src/api/graphql/resolvers/channels.js', () => ({
  isNotificationEnabled: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../channels/whatsapp/src/session.js', () => ({
  createWhatsAppSession: vi.fn().mockReturnValue({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockReturnValue(true),
    getSocket: vi.fn().mockReturnValue({
      sendMessage: vi.fn().mockResolvedValue({ key: { id: 'msg-id-123' } }),
      sendPresenceUpdate: vi.fn().mockResolvedValue(undefined),
      ev: { on: vi.fn() },
    }),
  }),
}));

interface MockSession {
  connect: (...args: unknown[]) => unknown;
  disconnect: (...args: unknown[]) => unknown;
  isConnected: (...args: unknown[]) => unknown;
  getSocket: (...args: unknown[]) => MockSocket;
}

interface MockSocket {
  sendMessage: ReturnType<typeof vi.fn>;
  sendPresenceUpdate: ReturnType<typeof vi.fn>;
  ev: { on: ReturnType<typeof vi.fn> };
}

function getMockSession(): MockSession {
  return vi.mocked(sessionModule.createWhatsAppSession).mock.results[0]?.value as MockSession;
}

function getMockSocket(): MockSocket {
  return getMockSession()?.getSocket() as MockSocket;
}

const SELF_JID = '1234567890@s.whatsapp.net';

describe('buildWhatsAppChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(fsp.access).mockResolvedValue(undefined);
    vi.mocked(fsp.readFile as (...args: unknown[]) => Promise<string>).mockResolvedValue(
      JSON.stringify({ me: { id: '1234567890:5@s.whatsapp.net' } }),
    );

    vi.mocked(sessionModule.createWhatsAppSession).mockReturnValue({
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockReturnValue(true),
      getSocket: vi.fn().mockReturnValue({
        sendMessage: vi.fn().mockResolvedValue({ key: { id: 'msg-id-123' } }),
        sendPresenceUpdate: vi.fn().mockResolvedValue(undefined),
        ev: { on: vi.fn() },
      }),
    });
  });

  describe('plugin identity', () => {
    it('has correct id and name', () => {
      const channel = buildWhatsAppChannel();
      expect(channel.id).toBe('whatsapp');
      expect(channel.name).toBe('WhatsApp');
    });

    it('includes wa alias', () => {
      const channel = buildWhatsAppChannel();
      expect(channel.aliases).toContain('wa');
    });
  });

  describe('capabilities', () => {
    it('has correct capabilities', () => {
      const channel = buildWhatsAppChannel();
      expect(channel.capabilities).toEqual({
        supportsThreading: false,
        supportsReactions: true,
        supportsTyping: true,
        supportsFiles: true,
        supportsEditing: false,
        maxMessageLength: 65536,
      });
    });
  });

  describe('adapters', () => {
    it('all adapters are present and callable', () => {
      const channel = buildWhatsAppChannel();
      expect(typeof channel.messagingAdapter.sendMessage).toBe('function');
      expect(typeof channel.messagingAdapter.onMessage).toBe('function');
      expect(typeof channel.authAdapter.validateToken).toBe('function');
      expect(typeof channel.setupAdapter.setup).toBe('function');
      expect(typeof channel.setupAdapter.teardown).toBe('function');
      expect(typeof channel.typingAdapter?.startTyping).toBe('function');
      expect(typeof channel.initialize).toBe('function');
      expect(typeof channel.shutdown).toBe('function');
    });
  });

  describe('onMessage', () => {
    it('registers handlers without error', () => {
      const channel = buildWhatsAppChannel();
      expect(() => {
        channel.messagingAdapter.onMessage(vi.fn());
        channel.messagingAdapter.onMessage(vi.fn());
      }).not.toThrow();
    });
  });

  describe('sendMessage', () => {
    it('throws when setup was skipped (no creds)', async () => {
      vi.mocked(fsp.readFile as (...args: unknown[]) => Promise<string>).mockResolvedValueOnce(JSON.stringify({}));

      const channel = buildWhatsAppChannel();
      await channel.setupAdapter.setup({});
      await expect(channel.messagingAdapter.sendMessage({ channelId: 'whatsapp', text: 'hello' })).rejects.toThrow(
        'WhatsApp socket not available',
      );
    });

    it('always sends to self-chat JID regardless of threadId', async () => {
      const channel = buildWhatsAppChannel();
      await channel.setupAdapter.setup({});

      await channel.messagingAdapter.sendMessage({
        channelId: 'whatsapp',
        threadId: '9999999999@s.whatsapp.net',
        text: 'test message',
      });

      const sock = getMockSocket();
      expect(sock.sendMessage).toHaveBeenCalledWith(SELF_JID, { text: 'test message' });
    });

    it('sends to self-chat JID derived from creds.json', async () => {
      const channel = buildWhatsAppChannel();
      await channel.setupAdapter.setup({});

      await channel.messagingAdapter.sendMessage({ channelId: 'whatsapp', text: 'hello' });

      const sock = getMockSocket();
      expect(sock.sendMessage).toHaveBeenCalledWith(SELF_JID, { text: 'hello' });
    });
  });

  describe('self-chat proxy isolation', () => {
    it('message handler only receives self-chat messages', async () => {
      const channel = buildWhatsAppChannel();
      await channel.setupAdapter.setup({});

      const sock = getMockSocket();
      const upsertHandler = sock.ev.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'messages.upsert',
      )?.[1] as (arg: { messages: unknown[] }) => Promise<void>;
      expect(upsertHandler).toBeDefined();

      const handler = vi.fn();
      channel.messagingAdapter.onMessage(handler);

      // Self-chat message — should be processed
      await upsertHandler({
        messages: [
          {
            key: { remoteJid: SELF_JID, fromMe: true, id: 'user-msg-1' },
            message: { conversation: 'hello yojin' },
            messageTimestamp: Math.floor(Date.now() / 1000),
          },
        ],
      });

      // Other person's message — should be dropped by proxy
      await upsertHandler({
        messages: [
          {
            key: { remoteJid: '5555555555@s.whatsapp.net', fromMe: false, id: 'other-msg' },
            message: { conversation: 'hey' },
            messageTimestamp: Math.floor(Date.now() / 1000),
          },
        ],
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ text: 'hello yojin', channelId: 'whatsapp' }));
    });

    it('proxy filters out tracked outbound messages', async () => {
      const channel = buildWhatsAppChannel();
      await channel.setupAdapter.setup({});

      // Send a message first to populate recentOutbound
      await channel.messagingAdapter.sendMessage({ channelId: 'whatsapp', text: 'from yojin' });

      const sock = getMockSocket();
      const upsertHandler = sock.ev.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'messages.upsert',
      )?.[1] as (arg: { messages: unknown[] }) => Promise<void>;

      const handler = vi.fn();
      channel.messagingAdapter.onMessage(handler);

      // Echo of our own outbound — should be filtered
      await upsertHandler({
        messages: [
          {
            key: { remoteJid: SELF_JID, fromMe: true, id: 'msg-id-123' },
            message: { conversation: 'from yojin' },
            messageTimestamp: Math.floor(Date.now() / 1000),
          },
        ],
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('authAdapter', () => {
    it('returns true when creds.json exists', async () => {
      const channel = buildWhatsAppChannel();
      expect(await channel.authAdapter.validateToken('')).toBe(true);
    });

    it('returns false when creds.json does not exist', async () => {
      vi.mocked(fsp.access).mockRejectedValueOnce(new Error('ENOENT'));
      const channel = buildWhatsAppChannel();
      expect(await channel.authAdapter.validateToken('')).toBe(false);
    });
  });

  describe('initialize / shutdown', () => {
    it('initialize calls session.connect', async () => {
      const channel = buildWhatsAppChannel();
      await channel.initialize?.({});
      expect(getMockSession().connect).toHaveBeenCalled();
    });

    it('shutdown disconnects session', async () => {
      const channel = buildWhatsAppChannel();
      await channel.initialize?.({});
      await channel.shutdown?.();
      expect(getMockSession().disconnect).toHaveBeenCalled();
    });
  });
});
