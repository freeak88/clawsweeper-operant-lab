# Guarded Commit Dry-run Executor

The Guarded Commit Dry-run Executor converts a ready Commit Intent into a deterministic command preview for operator review.

It does not stage files, run `git commit`, push, create PRs, call GitHub APIs, mutate source files, or change scheduler/apply/automerge behavior.

## CLI

```bash
pnpm run commit-dry-run-executor -- --commit-intent results/commit-intent/commit-intent.json --output-root results/commit-dry-run-executor
```

Output:

- `commit-dry-run-executor.json`
- `commit-dry-run-executor.md`

## Input

The input is a `commit-intent.json` artifact with:

- `status: ready`
- `proposed_commit_message`
- `files_expected`
- validation evidence and rollback context from earlier layers

Blocked and needs-review commit intents are preserved as blocked or needs-review previews.

## Output

The preview may include only:

- `git add <files_expected>`
- `git commit -m "<proposed_commit_message>"`

The executor always sets:

```json
{
  "would_execute": false
}
```

## Safety Boundary

D7 is dry-run only. It rejects malformed commit intents, empty file lists, non-conventional commit messages, shell chaining, network commands, GitHub CLI/API commands, destructive commands, push commands, and PR creation commands.

No staging or commit happens in this layer.

## Future Path

A future guarded local commit executor may execute the preview only with explicit operator approval, a clean isolated workspace, matching preview validation, and rollback logging.
