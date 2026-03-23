import { useCallback, useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import MorningBriefing from '../components/chat/morning-briefing';
import QueryBuilder from '../components/chat/query-builder';
import WaterfallFlow from '../components/chat/waterfall-flow';
import ManualPositionFlow from '../components/chat/manual-position-flow';
import ChatInput from '../components/chat/chat-input';
import type { ImageAttachment } from '../components/chat/chat-input';
import ChatMessage from '../components/chat/chat-message';
import ChatAvatar from '../components/chat/chat-avatar';
import { SessionSidebar } from '../components/chat/session-sidebar';
import { useChatContext } from '../lib/chat-context';

/* ─── Page ─── */

export default function Chat() {
  const {
    messages,
    pendingMessages,
    streamingContent,
    isLoading,
    isThinking,
    activeTools,
    sendMessage,
    activeSession,
  } = useChatContext();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
  }, [messages, isLoading, streamingContent, isThinking, activeTools]);

  // Reset UI state when session changes (state-during-render pattern, not an effect).
  // See: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const sessionThreadId = activeSession.threadId;
  const [prevSessionId, setPrevSessionId] = useState(sessionThreadId);
  if (prevSessionId !== sessionThreadId) {
    setPrevSessionId(sessionThreadId);
    setActiveCategory(null);
    setActiveAction(null);
  }

  const handleSend = useCallback(
    (content: string, image?: ImageAttachment) => {
      setActiveCategory(null);
      sendMessage(content, image);
    },
    [sendMessage],
  );

  const handleViewFullBriefing = useCallback(() => {
    sendMessage('Show me my full morning briefing');
  }, [sendMessage]);

  const handleQuerySelect = useCallback((categoryId: string) => {
    setActiveCategory(categoryId);
  }, []);

  const handleWaterfallComplete = useCallback(
    (query: string) => {
      setActiveCategory(null);
      sendMessage(query);
    },
    [sendMessage],
  );

  const handleWaterfallAction = useCallback(
    (action: string, displayLabel: string) => {
      setActiveCategory(null);

      // Non-tool actions (e.g. add-asset) use the manual entry flow
      if (action === 'add-asset') {
        setActiveAction(action);
        return;
      }

      // All tool actions go through the backend as real messages
      sendMessage(displayLabel);
    },
    [sendMessage],
  );

  const handleActionComplete = useCallback(() => {
    setActiveAction(null);
  }, []);

  const handleActionCancel = useCallback(() => {
    setActiveAction(null);
  }, []);

  const handleWaterfallCancel = useCallback(() => {
    setActiveCategory(null);
  }, []);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sessions sidebar */}
      <SessionSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((prev) => !prev)} />

      {/* Main chat area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Messages area */}
        <div ref={scrollRef} className="flex-1 overflow-auto px-6 py-6">
          <div className="mx-auto max-w-3xl space-y-6">
            {/* Morning briefing — shown only for sessions with no messages */}
            {messages.length === 0 && (
              <ChatMessage role="assistant">
                <MorningBriefing
                  date={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  updatedAt={`Updated ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                  onViewFull={handleViewFullBriefing}
                />
              </ChatMessage>
            )}

            {/* Server messages (from chat context) */}
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                id={msg.id}
                role={msg.role}
                content={msg.content}
                piiProtected={msg.piiProtected}
                piiTypes={msg.piiTypes}
                toolCards={msg.toolCards}
              />
            ))}

            {/* Streaming response */}
            {streamingContent && <ChatMessage id="streaming" role="assistant" content={streamingContent} />}

            {/* Pending queued messages — rendered after streaming so conversation order is preserved */}
            {pendingMessages.map((msg) => (
              <ChatMessage key={msg.id} role="user" content={msg.content} />
            ))}

            {/* Loading / thinking / tool indicators */}
            {isLoading && !streamingContent && (
              <div className="flex items-start gap-3">
                <ChatAvatar />
                <div className="flex flex-col gap-2">
                  {isThinking && (
                    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-card px-3 py-1.5">
                      <div className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-primary" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-primary [animation-delay:0.2s]" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-primary [animation-delay:0.4s]" />
                      </div>
                      <span className="text-xs text-text-secondary">Thinking</span>
                    </div>
                  )}

                  {activeTools.map((tool, i) => (
                    <div
                      key={`${tool}-${i}`}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-card px-3 py-1.5"
                    >
                      <svg className="h-3.5 w-3.5 animate-spin text-accent-primary" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      <span className="font-mono text-xs text-text-secondary">{tool}</span>
                    </div>
                  ))}

                  {!isThinking && activeTools.length === 0 && (
                    <div className="rounded-2xl rounded-tl-sm border border-border bg-bg-card px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Query builder / waterfall / manual entry — shown when no messages */}
        {messages.length === 0 && (
          <div className="px-6 pb-4 pt-2">
            <div className="mx-auto max-w-3xl">
              {activeAction === 'add-asset' ? (
                <ManualPositionFlow onComplete={handleActionComplete} onCancel={handleActionCancel} />
              ) : activeCategory ? (
                <WaterfallFlow
                  categoryId={activeCategory}
                  onComplete={handleWaterfallComplete}
                  onAction={handleWaterfallAction}
                  onCancel={handleWaterfallCancel}
                />
              ) : (
                <QueryBuilder onSelect={handleQuerySelect} />
              )}
            </div>
          </div>
        )}

        {/* Chat input — always visible */}
        <div className="px-6 pb-6">
          <div className="mx-auto max-w-3xl">
            <ChatInput onSend={handleSend} disableAttachment={isLoading} initialValue={presetMessage} />
          </div>
        </div>
      </div>
    </div>
  );
}
