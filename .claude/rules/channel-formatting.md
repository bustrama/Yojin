# Channel Formatting Rules

## Telegram HTML Mode
- **Escape ALL text before embedding in HTML.** Telegram's HTML parser is strict — unescaped `&`, `<`, `>` in any position (including hardcoded strings like `P&L`) will cause message delivery failures. Always use `escapeHtml()` from `src/formatting/escape-html.ts`.
- **Escape LLM response text.** When concatenating agent/LLM output with HTML-formatted display cards, the LLM text must be escaped before concatenation. LLM output routinely contains `<`, `>`, `&` characters.
- **Use `&amp;` in hardcoded Telegram HTML strings.** Even in template literals that look like plain text, if `parse_mode: 'HTML'` is set, every `&` must be `&amp;`.

## Shared Formatting
- Channel-agnostic formatting helpers live in `src/formatting/` (chunk-message, escape-html).
- Channel-specific display card formatters live in `src/tools/channel-display-formatters.ts`.
- Don't duplicate escape/chunk logic per channel — import from the shared module.
