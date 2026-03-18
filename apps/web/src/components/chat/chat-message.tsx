import Markdown from 'react-markdown';

interface ChatMessageProps {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  piiProtected?: boolean;
  piiTypes?: string[];
}

const PII_LABELS: Record<string, string> = {
  EMAIL: 'email',
  PHONE: 'phone',
  SSN: 'SSN',
  CREDIT_CARD: 'card number',
  ADDRESS: 'address',
  NAME: 'name',
};

function formatPiiTypes(types: string[]): string {
  return types.map((t) => PII_LABELS[t] ?? t.toLowerCase()).join(', ');
}

export default function ChatMessage({ role, content, piiProtected, piiTypes }: ChatMessageProps) {
  if (role === 'assistant') {
    return (
      <div className="flex gap-3">
        <img src="/yojin_inverse_avatar.png" alt="Yojin" className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
        <div className="flex max-w-[80%] flex-col gap-1">
          <div className="bg-bg-card border-border rounded-2xl rounded-tl-sm border px-4 py-3">
            <div className="text-text-primary prose prose-invert prose-sm max-w-none leading-relaxed">
              <Markdown>{content}</Markdown>
            </div>
          </div>
          {piiProtected && piiTypes && piiTypes.length > 0 && (
            <div className="inline-flex items-center gap-1.5 self-start px-1">
              <svg className="h-3 w-3 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-[10px] text-emerald-400/80">
                Your {formatPiiTypes(piiTypes)} was not shared with the AI
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-end gap-3">
      <div className="bg-accent-primary/10 border-accent-primary/20 max-w-[80%] rounded-2xl rounded-tr-sm border px-4 py-3">
        <p className="text-text-primary text-sm leading-relaxed">{content}</p>
      </div>
      <div className="bg-bg-tertiary text-text-secondary flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium">
        DS
      </div>
    </div>
  );
}
