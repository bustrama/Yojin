---
description: SOLID/DRY principles and code quality standards
globs: ["src/**/*.ts", "providers/**/*.ts", "channels/**/*.ts", "packages/**/*.ts"]
---

# Code Quality

## Single Responsibility

One module, one job. Agent profiles don't do enrichment. Guards don't analyze risk. The enrichment pipeline doesn't send alerts.

## Open/Closed

Extend via interfaces, not modification:
- New guard → implement `Guard` interface, register in guard registry
- New channel → implement `ChannelPlugin` interface in `channels/<id>/`
- New provider → implement `ProviderPlugin` interface in `providers/<id>/`
- New alert rule → implement rule interface in `src/alerts/rules/`
- New scraper → implement `IPortfolioScraper` in `src/scraper/platforms/`

## Dependency Inversion

- Depend on interfaces (`Guard`, `IPortfolioScraper`, `ChannelPlugin`), not concrete classes.
- The composition root (`src/main.ts`) wires everything — modules don't instantiate their own dependencies.
- No service locator pattern. Pass dependencies explicitly via `YojinContext`.

## DRY

- Zod schemas are the single source of truth for validation — don't duplicate checks.
- Shared types go in the module's `types.ts`, not duplicated across files.
- Config is loaded once in the composition root and passed via context.
- Extract when code appears 3+ times. Don't pre-abstract for hypothetical reuse.

## Error Handling

- Use Result-style returns (`{ success: true, data } | { success: false, error }`) for expected failures.
- Thrown errors are for unexpected/programmer errors only.
- Log errors with context before propagating: `logger.error('Failed to enrich', { symbol, error })`.
- Never swallow errors silently.
- In `finally` blocks, wrap cleanup in its own try/catch to avoid suppressing the original exception.
- When a function has setup + action + cleanup, decide explicitly whether setup failure should abort or be best-effort. Match the error strategy symmetrically.

## Wiring Completeness

- **Wire optional dependencies at every call site.** When adding an optional parameter to an interface (e.g. `memoryStore?: SignalMemoryStore`), TypeScript won't warn if callers omit it. Grep for all call sites of the function/constructor and wire the new dependency at each one — or the feature will be silently dead in production behind an `if (dependency)` guard.
- **Apply conditional patterns symmetrically.** When multiple agents in a workflow use the same `hasX ? value : fallback` pattern, apply it consistently to all agents — don't hardcode values for some while making others conditional.

## Refactoring — Ask First

Before making breaking changes to:
- Agent profiles or tool scoping
- Plugin interfaces (ProviderPlugin, ChannelPlugin)
- Guard pipeline order or behavior
- Data file formats (JSONL schemas, config structure)
- YojinContext shape
