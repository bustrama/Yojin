# Codex Workspace Notes

This folder mirrors the reusable instruction layout under `.claude/` for Codex-oriented discovery.

## Structure

- `agents/` mirrors agent-specific role briefs.
- `commands/` mirrors slash-command style workflow docs.
- `rules/` mirrors repository rules and coding constraints.

## Canonical Source

Until a Codex-specific workflow needs to diverge, the matching file under `.claude/` remains the canonical source.

## Intentionally Excluded

- `.claude/worktrees/` because it is generated runtime state, not reusable guidance.
- `.claude/hooks/` because those hooks are wired through Claude settings.
- `.claude/settings.json` and `.claude/settings.local.json` because those are Claude-specific runtime config files rather than portable project docs.

When Codex-specific behavior needs to differ, replace the corresponding mirror file with a full standalone version instead of adding a second competing source elsewhere.
