# Worktree + Jira

Create a new git worktree and start working on a Jira issue.

## Usage
```
/worktree-jira <jira-issue-url-or-key>
```

Example:
```
/worktree-jira https://othentic.atlassian.net/browse/YOJ-160
/worktree-jira YOJ-160
```

## Behavior

### Step 1: Parse the issue key
Extract the Jira issue key from the argument. It can be:
- A full URL like `https://othentic.atlassian.net/browse/YOJ-160` → extract `YOJ-160`
- A bare key like `YOJ-160`

### Step 2: Fetch the Jira issue
Use the Atlassian MCP tool `getJiraIssue` with:
- `cloudId`: `othentic.atlassian.net`
- `issueIdOrKey`: the extracted key
- `responseContentFormat`: `markdown`

Display a brief summary: title, status, assignee, and description highlights.

### Step 3: Create the worktree
Derive a branch name from the issue summary:
- Format: `feat/<kebab-case-summary>` (for stories/tasks) or `fix/<kebab-case-summary>` (for bugs)
- Keep it short — max 5-6 words
- Example: `feat/filter-false-match-signals`

Use the `EnterWorktree` tool with the derived name.

### Step 4: Rename the branch
The worktree tool prefixes the branch with `worktree-`. Rename it:
```bash
git branch -m worktree-<name> <name>
```

### Step 5: Transition the issue
Move the Jira issue to "In Progress" using the `transitionJiraIssue` tool. First call `getTransitionsForJiraIssue` to find the correct transition ID.

### Step 6: Ready to work
Confirm the setup is complete and show:
- Branch name
- Worktree path
- Issue summary
- Ask what approach the user wants to take (per the collaborative planning feedback)

## Notes
- The Jira site is always `othentic.atlassian.net`
- Always use `responseContentFormat: markdown` when fetching issues
- Follow the project's branch naming conventions from `.claude/rules/git-workflow.md`
