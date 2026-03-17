# Plugin Usage Rules

## Automated Checks

### code-review
- Run `/review` on every PR before merging
- Use when reviewing code from other contributors

### pr-review-toolkit
- Use `/review-pr` for comprehensive PR reviews (comments, tests, error handling, types, quality)
- Run before requesting human review on PRs

### code-simplifier
- Run `/simplify` after completing a feature or refactor to clean up the code
- Focus on recently modified files

### security-guidance
- Active automatically on every file edit via hooks
- Pay attention to its warnings — Yojin's trust layer is a core differentiator

### typescript-lsp
- Active automatically — provides type-aware code intelligence
- Use LSP diagnostics to catch type errors before running `pnpm typecheck`

## Pre-PR Checklist

Before creating any PR, run this sequence:
1. `pnpm run ci` (typecheck + lint + test)
2. `/simplify` on changed files
3. `/review` for automated code review

## When NOT to use plugins
- Don't run `/review` on trivial changes (typo fixes, comment updates)
- Don't run `/simplify` on code you didn't modify — respect existing patterns
