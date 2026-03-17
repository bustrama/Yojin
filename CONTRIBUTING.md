# Contributing to Yojin

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/YojinHQ/Yojin.git
cd Yojin
pnpm install
pnpm run ci   # typecheck + lint + test
```

Requirements: Node.js >= 20, pnpm 10+

## Making Changes

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run the full check: `pnpm run ci`
4. Push and open a PR

## Branch Naming

```
feat/<short-description>     # New features
fix/<short-description>      # Bug fixes
refactor/<short-description> # Code restructuring
```

## Code Style

- TypeScript strict mode, ESM only (`.js` extensions in imports)
- Zod schemas for all external data validation
- `interface` over `type` for object shapes that will be implemented
- Result-style returns for expected failures, thrown errors for programmer bugs
- Files: `kebab-case.ts`, Classes: `PascalCase`, functions: `camelCase`

ESLint enforces the rules — `pnpm lint` must pass.

## Testing

- vitest for all tests
- Test files go in `test/` or co-located as `*.test.ts`
- `describe`/`it` blocks, behavior-focused names
- Prefer real data fixtures over mocks

## Architecture

Before making changes, read `CLAUDE.md` for module boundaries. Key rules:

- **Guards** (`src/guards/`) are generic safety — no finance logic
- **Risk** (`src/risk/`) is finance analysis — never blocks actions
- **Agents** communicate through shared state, not direct calls
- **All state** is file-driven (JSONL/JSON in `data/`) — no database

### Extension Points

| What | Where | Interface |
|------|-------|-----------|
| LLM provider | `providers/<id>/` | `ProviderPlugin` |
| Channel | `channels/<id>/` | `ChannelPlugin` |
| Guard | `src/guards/` | `Guard` |
| Scraper | `src/scraper/platforms/` | `IPortfolioScraper` |
| Alert rule | `src/alerts/rules/` | Rule interface |

## Pull Requests

- Keep PRs focused — one feature or fix per PR
- Include tests for new functionality
- Update `README.md` if you change public structure (see `.claude/rules/readme-maintenance.md`)
- CI must pass (typecheck + lint + test)

## Reporting Bugs

Use [GitHub Issues](https://github.com/YojinHQ/Yojin/issues) with the bug report template.

## Security

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
