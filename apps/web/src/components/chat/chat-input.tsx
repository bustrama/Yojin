import { useState } from 'react';
import { cn } from '../../lib/utils';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  initialValue?: string;
}

export default function ChatInput({
  onSend,
  disabled,
  placeholder = 'How can I help you today?',
  initialValue,
}: ChatInputProps) {
  const [value, setValue] = useState(initialValue ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue('');
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-3 rounded-2xl border border-border/60 bg-bg-secondary px-5 py-3"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
        disabled={disabled}
      />
      <button
        type="submit"
        disabled={!value.trim() || disabled}
        className={cn(
          'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-colors',
          value.trim() && !disabled
            ? 'bg-accent-primary text-white hover:bg-accent-secondary cursor-pointer'
            : 'bg-bg-tertiary text-text-muted cursor-default',
        )}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </form>
  );
}
