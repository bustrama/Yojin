import { useCallback, useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import MorningBriefing from '../components/chat/morning-briefing';
import QueryBuilder from '../components/chat/query-builder';
import WaterfallFlow from '../components/chat/waterfall-flow';
import ChatInput from '../components/chat/chat-input';
import ChatMessage from '../components/chat/chat-message';
import ChatAvatar from '../components/chat/chat-avatar';
import RichCard from '../components/chat/rich-card';

/* ─── Message types ─── */

interface TextMessage {
  id: string;
  role: 'assistant' | 'user';
  type: 'text';
  content: string;
}

interface BriefingMessage {
  id: string;
  role: 'assistant';
  type: 'briefing';
}

type Message = TextMessage | BriefingMessage;

/* ─── API call ─── */

async function sendChatMessage(message: string, threadId: string): Promise<{ threadId: string; response: string }> {
  let res: Response;
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, threadId }),
    });
  } catch {
    throw new Error('Cannot reach the backend. Is the server running? (pnpm dev)');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  }

  const data = (await res.json()) as { threadId: string; response: string };
  if (typeof data.response !== 'string') {
    throw new Error('Unexpected response format from server');
  }
  return data;
}

/* ─── Mock briefing rich card ─── */

function FullBriefingCard() {
  return (
    <RichCard>
      <RichCard.Header icon="📊" title="Morning Briefing — Full Report" badge="DAILY" />
      <RichCard.Body>
        Your portfolio is up 1.2% since yesterday&apos;s close. Three positions need attention: NVDA earnings beat
        expectations but guidance was mixed, TSLA hit a 52-week low, and your AAPL position crossed the 30%
        concentration threshold.
      </RichCard.Body>
      <RichCard.Stats
        items={[
          { value: '$124,500', label: 'Total Value' },
          { value: '+$1,470', label: 'Day Change', highlight: true },
          { value: '23.4%', label: 'YTD Return' },
          { value: '72', label: 'Risk Score' },
        ]}
      />
      <RichCard.Table
        columns={[
          { key: 'symbol', header: 'Symbol' },
          { key: 'price', header: 'Price' },
          { key: 'change', header: 'Day Change' },
          { key: 'status', header: 'Status' },
        ]}
        rows={[
          {
            symbol: 'AAPL',
            price: '$198.50',
            change: '+1.8%',
            status: <span className="text-warning">⚠ Concentrated</span>,
          },
          {
            symbol: 'NVDA',
            price: '$875.30',
            change: '+3.2%',
            status: <span className="text-success">✓ Earnings Beat</span>,
          },
          {
            symbol: 'TSLA',
            price: '$162.10',
            change: '-4.1%',
            status: <span className="text-error">⚠ 52w Low</span>,
          },
          {
            symbol: 'MSFT',
            price: '$415.80',
            change: '+0.6%',
            status: <span className="text-success">✓ Healthy</span>,
          },
          {
            symbol: 'AMZN',
            price: '$186.20',
            change: '+1.1%',
            status: <span className="text-success">✓ Healthy</span>,
          },
        ]}
      />
      <RichCard.Divider />
      <RichCard.Actions
        actions={[{ label: 'Rebalance Portfolio' }, { label: 'View Risk Report' }, { label: 'Set Alerts' }]}
      />
    </RichCard>
  );
}

/* ─── Render a single message ─── */

function renderMessage(msg: Message) {
  if (msg.role === 'user') {
    return <ChatMessage key={msg.id} role="user" content={(msg as TextMessage).content} />;
  }

  if (msg.type === 'briefing') {
    return (
      <ChatMessage key={msg.id} role="assistant">
        <FullBriefingCard />
      </ChatMessage>
    );
  }

  return <ChatMessage key={msg.id} role="assistant" content={(msg as TextMessage).content} />;
}

/* ─── Page ─── */

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [threadId] = useState(() => `web-${crypto.randomUUID()}`);
  const scrollRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Read preset message from location state (e.g. from "Add to Chat" on intel cards)
  const [presetMessage] = useState<string | undefined>(() => (location.state as { preset?: string } | null)?.preset);

  // Clear location state so refreshing doesn't re-populate
  useEffect(() => {
    if (presetMessage) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [presetMessage, navigate, location.pathname]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = useCallback(
    async (content: string) => {
      setActiveCategory(null);
      const userMessage: TextMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        type: 'text',
        content,
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const { response } = await sendChatMessage(content, threadId);
        const assistantMessage: TextMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          type: 'text',
          content: response,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        const errorText = err instanceof Error ? err.message : 'Something went wrong';
        const errorMessage: TextMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          type: 'text',
          content: `Sorry, I couldn't process that request. ${errorText}`,
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [threadId],
  );

  const handleViewFullBriefing = useCallback(() => {
    const userMsg: TextMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      type: 'text',
      content: 'Show me my full morning briefing',
    };
    const briefingMsg: BriefingMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      type: 'briefing',
    };
    setMessages((prev) => [...prev, userMsg, briefingMsg]);
  }, []);

  const handleQuerySelect = useCallback((categoryId: string) => {
    setActiveCategory(categoryId);
  }, []);

  const handleWaterfallComplete = useCallback(
    (query: string) => {
      setActiveCategory(null);
      handleSend(query);
    },
    [handleSend],
  );

  const handleWaterfallCancel = useCallback(() => {
    setActiveCategory(null);
  }, []);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-auto px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Morning briefing — always shown as first AI message */}
          <ChatMessage role="assistant">
            <MorningBriefing onViewFull={handleViewFullBriefing} />
          </ChatMessage>

          {messages.map(renderMessage)}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-start gap-3">
              <ChatAvatar />
              <div className="rounded-2xl rounded-tl-sm border border-border bg-bg-card px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Query builder / waterfall — shown when no user messages */}
      {messages.length === 0 && (
        <div className="px-6 pb-4 pt-2">
          <div className="mx-auto max-w-3xl">
            {activeCategory ? (
              <WaterfallFlow
                categoryId={activeCategory}
                onComplete={handleWaterfallComplete}
                onCancel={handleWaterfallCancel}
              />
            ) : (
              <QueryBuilder onSelect={handleQuerySelect} />
            )}
          </div>
        </div>
      )}

      {/* Chat input — pinned bottom */}
      <div className="px-6 pb-6">
        <div className="mx-auto max-w-3xl">
          <ChatInput onSend={handleSend} disabled={isLoading} initialValue={presetMessage} />
        </div>
      </div>
    </div>
  );
}
