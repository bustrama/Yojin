import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import ChatAvatar from './chat-avatar';

export interface ChatMessageProps {
  id?: string;
  role: 'assistant' | 'user';
  content?: string;
  children?: ReactNode;
  className?: string;
}

export default function ChatMessage({ role, content, children, className }: ChatMessageProps) {
  if (role === 'user') {
    return (
      <div className={cn('flex justify-end', className)}>
        <div className="max-w-[80%] rounded-full bg-accent-primary px-5 py-2.5">
          <p className="text-sm leading-relaxed text-white">{content ?? children}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex items-start gap-3', className)}>
      <ChatAvatar />
      <div className="min-w-0 max-w-[85%]">
        {children ?? (
          <div className="rounded-2xl rounded-tl-sm border border-border bg-bg-card px-4 py-3">
            <p className="text-sm leading-relaxed text-text-primary">{content}</p>
          </div>
        )}
      </div>
    </div>
  );
}
