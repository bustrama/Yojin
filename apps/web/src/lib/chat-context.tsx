import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useClient, useMutation, useSubscription } from 'urql';
import { SESSION_DETAIL_QUERY } from './session-queries';

export interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  piiProtected?: boolean;
  piiTypes?: string[];
}

interface ChatEvent {
  type: 'THINKING' | 'TOOL_USE' | 'TEXT_DELTA' | 'MESSAGE_COMPLETE' | 'PII_REDACTED' | 'ERROR';
  threadId: string;
  delta?: string;
  messageId?: string;
  content?: string;
  error?: string;
  toolName?: string;
  piiTypesFound?: string[];
}

const SEND_MESSAGE_MUTATION = `
  mutation SendMessage($threadId: String!, $message: String!, $imageBase64: String, $imageMediaType: String) {
    sendMessage(threadId: $threadId, message: $message, imageBase64: $imageBase64, imageMediaType: $imageMediaType) {
      threadId
      messageId
    }
  }
`;

const CHAT_SUBSCRIPTION = `
  subscription OnChatMessage($threadId: String!) {
    onChatMessage(threadId: $threadId) {
      type
      threadId
      delta
      messageId
      content
      error
      toolName
      piiTypesFound
    }
  }
`;

export interface ChatImageData {
  base64: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
}

/** Session info exposed to consumers. */
export interface ActiveSessionInfo {
  sessionId: string | null;
  threadId: string;
}

interface ChatContextValue {
  messages: ChatMessage[];
  pendingMessages: ChatMessage[];
  streamingContent: string;
  isLoading: boolean;
  isThinking: boolean;
  activeTools: string[];
  sendMessage: (content: string, image?: ChatImageData) => void;
  /** Current session info. */
  activeSession: ActiveSessionInfo;
  /** Switch to an existing session or start a new one (pass null). */
  switchSession: (sessionId: string | null, threadId?: string) => void;
  /** Increments when session list may have changed (message sent, session created, etc.). */
  sessionVersion: number;
}

const STORAGE_KEY = 'yojin-active-thread';

const ChatContext = createContext<ChatContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider');
  return ctx;
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const client = useClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingMessages, setPendingMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [activeTools, setActiveTools] = useState<string[]>([]);

  // Session state — restored from localStorage or new
  const [threadId, setThreadId] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored || `web-${crypto.randomUUID()}`;
  });
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Version counter — bumped whenever the backend session list may have changed
  const [sessionVersion, setSessionVersion] = useState(0);
  // Guard against stale async results in switchSession
  const switchVersionRef = useRef(0);

  const completedMessagesRef = useRef(new Set<string>());
  const queueRef = useRef<string[]>([]);
  const isProcessingRef = useRef(false);
  const piiDetectedRef = useRef(false);
  const piiTypesRef = useRef<string[]>([]);

  const [, sendMessageMutation] = useMutation(SEND_MESSAGE_MUTATION);
  const processQueueRef = useRef<() => void>(() => {});

  // Persist active threadId to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, threadId);
  }, [threadId]);

  const resetStreamingState = useCallback(() => {
    setStreamingContent('');
    setIsThinking(false);
    setActiveTools([]);
    setIsLoading(false);
    isProcessingRef.current = false;
  }, []);

  const processMessage = useCallback(
    async (content: string, image?: ChatImageData) => {
      isProcessingRef.current = true;
      piiDetectedRef.current = false;
      piiTypesRef.current = [];
      setIsLoading(true);
      setStreamingContent('');
      setIsThinking(false);
      setActiveTools([]);

      const variables: Record<string, string> = { threadId, message: content };
      if (image) {
        variables.imageBase64 = image.base64;
        variables.imageMediaType = image.mediaType;
      }

      const result = await sendMessageMutation(variables);
      if (result.error) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `Sorry, I couldn't process that request. ${result.error?.message ?? ''}`,
          },
        ]);
        resetStreamingState();
        processQueueRef.current();
      }
    },
    [threadId, sendMessageMutation, resetStreamingState],
  );

  const processQueue = useCallback(() => {
    if (queueRef.current.length > 0 && !isProcessingRef.current) {
      const next = queueRef.current.shift();
      if (!next) return;
      // Move the first pending message into the main messages list.
      setPendingMessages((prev) => prev.slice(1));
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', content: next }]);
      processMessage(next);
    }
  }, [processMessage]);

  useEffect(() => {
    processQueueRef.current = processQueue;
  }, [processQueue]);

  const handleSubscription = useCallback(
    (_prev: unknown, data: { onChatMessage: ChatEvent }) => {
      const event = data.onChatMessage;

      if (event.type === 'THINKING') {
        setIsThinking(true);
        setActiveTools([]);
      } else if (event.type === 'PII_REDACTED') {
        piiDetectedRef.current = true;
        piiTypesRef.current = event.piiTypesFound ?? [];
      } else if (event.type === 'TOOL_USE' && event.toolName) {
        setIsThinking(false);
        setActiveTools((prev) => [...prev, event.toolName ?? '']);
      } else if (event.type === 'TEXT_DELTA' && event.delta != null) {
        setIsThinking(false);
        setActiveTools([]);
        setStreamingContent((prev) => prev + event.delta);
      } else if (event.type === 'MESSAGE_COMPLETE') {
        const msgId = event.messageId ?? crypto.randomUUID();
        if (completedMessagesRef.current.has(msgId)) return data;
        completedMessagesRef.current.add(msgId);
        setMessages((prev) => [
          ...prev,
          {
            id: msgId,
            role: 'assistant',
            content: event.content ?? '',
            piiProtected: piiDetectedRef.current,
            piiTypes: piiTypesRef.current,
          },
        ]);
        // Notify sidebar that the session list may have changed (new session created, message count updated)
        setSessionVersion((v) => v + 1);
        resetStreamingState();
        setTimeout(() => processQueue(), 0);
      } else if (event.type === 'ERROR') {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: 'assistant', content: `Sorry, something went wrong. ${event.error ?? ''}` },
        ]);
        resetStreamingState();
        setTimeout(() => processQueue(), 0);
      }

      return data;
    },
    [processQueue, resetStreamingState],
  );

  // Always subscribe to the active thread
  useSubscription({ query: CHAT_SUBSCRIPTION, variables: { threadId } }, handleSubscription);

  const sendMessage = useCallback(
    (content: string, image?: ChatImageData) => {
      if (isProcessingRef.current) {
        queueRef.current.push(content);
        // Show queued message separately so it renders after the current streaming response.
        setPendingMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', content }]);
      } else {
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', content }]);
        processMessage(content, image);
      }
    },
    [processMessage],
  );

  /** Switch to a session. Pass null to start a new session. */
  const switchSession = useCallback(
    (newSessionId: string | null, newThreadId?: string) => {
      // Reset streaming state
      resetStreamingState();
      completedMessagesRef.current.clear();
      queueRef.current = [];
      setPendingMessages([]);

      // Increment switch version — any in-flight fetch from a previous switch will be discarded
      const version = ++switchVersionRef.current;

      if (newSessionId === null) {
        // New session — use provided threadId if available (e.g. from createSession mutation)
        const fresh = newThreadId ?? `web-${crypto.randomUUID()}`;
        setThreadId(fresh);
        setSessionId(null);
        setMessages([]);
        return;
      }

      // Load existing session — set threadId synchronously so the UI resets immediately
      setSessionId(newSessionId);
      setMessages([]);
      if (newThreadId) setThreadId(newThreadId);

      // Fetch session messages (network-only to avoid stale cached data)
      void (async () => {
        const result = await client
          .query(SESSION_DETAIL_QUERY, { id: newSessionId }, { requestPolicy: 'network-only' })
          .toPromise();

        // Stale guard: if another switch happened since we started, discard this result
        if (switchVersionRef.current !== version) return;

        if (result.data?.session) {
          const session = result.data.session as {
            threadId: string;
            messages: { id: string; role: string; content: string }[];
          };
          setThreadId(newThreadId ?? session.threadId);
          setMessages(
            session.messages.map((m) => ({
              id: m.id,
              role: m.role === 'USER' ? ('user' as const) : ('assistant' as const),
              content: m.content,
            })),
          );
        }
      })();
    },
    [client, resetStreamingState],
  );

  const activeSessionInfo: ActiveSessionInfo = {
    sessionId,
    threadId,
  };

  const value: ChatContextValue = {
    messages,
    pendingMessages,
    streamingContent,
    isLoading,
    isThinking,
    activeTools,
    sendMessage,
    activeSession: activeSessionInfo,
    switchSession,
    sessionVersion,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
