import { useCallback, useRef, useState, useEffect } from 'react';
import { useMutation, useSubscription } from 'urql';
import MorningBriefing from '../components/chat/morning-briefing';
import QueryBuilder from '../components/chat/query-builder';
import ChatInput from '../components/chat/chat-input';
import ChatMessage from '../components/chat/chat-message';

interface Message {
  id: string;
  role: 'assistant' | 'user';
  content: string;
}

const SEND_MESSAGE_MUTATION = `
  mutation SendMessage($threadId: String!, $message: String!) {
    sendMessage(threadId: $threadId, message: $message) {
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
    }
  }
`;

interface ChatEvent {
  type: 'TEXT_DELTA' | 'MESSAGE_COMPLETE' | 'ERROR';
  threadId: string;
  delta?: string;
  messageId?: string;
  content?: string;
  error?: string;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [threadId] = useState(() => `web-${crypto.randomUUID()}`);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, streamingContent]);

  // Subscribe to chat events (SSE via GraphQL subscription)
  const handleSubscription = useCallback((_prev: unknown, data: { onChatMessage: ChatEvent }) => {
    const event = data.onChatMessage;

    if (event.type === 'TEXT_DELTA' && event.delta) {
      setStreamingContent((prev) => prev + event.delta);
    } else if (event.type === 'MESSAGE_COMPLETE' && event.content) {
      setMessages((prev) => [
        ...prev,
        {
          id: event.messageId ?? crypto.randomUUID(),
          role: 'assistant',
          content: event.content ?? '',
        },
      ]);
      setStreamingContent('');
      setIsLoading(false);
    } else if (event.type === 'ERROR') {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Sorry, something went wrong. ${event.error ?? ''}`,
        },
      ]);
      setStreamingContent('');
      setIsLoading(false);
    }

    return data;
  }, []);

  useSubscription({ query: CHAT_SUBSCRIPTION, variables: { threadId } }, handleSubscription);

  const [, sendMessage] = useMutation(SEND_MESSAGE_MUTATION);

  const handleSend = useCallback(
    async (content: string) => {
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setStreamingContent('');

      const result = await sendMessage({ threadId, message: content });
      if (result.error) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `Sorry, I couldn't process that request. ${result.error?.message ?? ''}`,
          },
        ]);
        setIsLoading(false);
      }
    },
    [threadId, sendMessage],
  );

  const handleQuerySelect = useCallback(
    (query: string) => {
      handleSend(query);
    },
    [handleSend],
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Messages area - scrollable */}
      <div ref={scrollRef} className="flex-1 overflow-auto px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <MorningBriefing />
          {messages.map((msg) => (
            <ChatMessage key={msg.id} id={msg.id} role={msg.role} content={msg.content} />
          ))}
          {/* Streaming response */}
          {streamingContent && <ChatMessage id="streaming" role="assistant" content={streamingContent} />}
          {/* Loading indicator (before first delta arrives) */}
          {isLoading && !streamingContent && (
            <div className="flex gap-3">
              <img
                src="/yojin_inverse_avatar.png"
                alt="Yojin"
                className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
              />
              <div className="bg-bg-card border-border rounded-2xl rounded-tl-sm border px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="bg-text-muted h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.3s]" />
                  <span className="bg-text-muted h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.15s]" />
                  <span className="bg-text-muted h-1.5 w-1.5 animate-bounce rounded-full" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Query builder - shown when no messages yet */}
      {messages.length === 0 && (
        <div className="px-6 pb-2">
          <div className="mx-auto max-w-3xl">
            <QueryBuilder onSelect={handleQuerySelect} />
          </div>
        </div>
      )}

      {/* Chat input - pinned bottom */}
      <div className="px-6 pb-6">
        <div className="mx-auto max-w-3xl">
          <ChatInput onSend={handleSend} disabled={isLoading} />
        </div>
      </div>
    </div>
  );
}
