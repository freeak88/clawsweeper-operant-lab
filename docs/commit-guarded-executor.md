# Guarded Local Commit Execution

The Guarded Local Commit Executor is the first commit-capable layer in Camino D. It can stage expected files and create a local commit only when explicitly invoked with `--execute`.

Default mode is dry-run. It does not stage files, commit, push, create PRs, call GitHub APIs, or change scheduler/apply/automerge behavior.

## CLI

Dry-run:

```bash
pnpm run commit-guarded-executor -- --commit-intent results/commit-intent/commit-intent.json --preview results/commit-dry-run-executor/commit-dry-run-executor.json --output-root results/commit-guarded-executor
```

Execute local commit:

```bash
pnpm run commit-guarded-executor -- --commit-intent results/commit-intent/commit-intent.json --preview results/commit-dry-run-executor/commit-dry-run-executor.json --output-root results/commit-guarded-executor --execute
```

## Execution Rules

Execution requires:

- ready commit intent
- ready dry-run preview
- `preview.would_execute === false`
- preview commands matching deterministic expected commands
- non-empty expected files
- conventional commit message matching the intent
- changed files limited to the expected file list

The only commands the executor may run are:

- `git add <expected files>`
- `git commit -m <message>`
- `git rev-parse HEAD`

## Output

The executor writes:

- `commit-guarded-execution.json`
- `commit-guarded-execution.md`

The output includes status, command list, commit hash when executed, rollback instruction, and the next safe step.

## Rollback

When a commit is created, the rollback instruction is:

```bash
git reset --soft HEAD~1
```

This keeps changes in the working tree for operator review.

## Safety Boundary

D8 is local-only. It never pushes, creates PRs, calls GitHub APIs, dispatches repairs, or changes scheduler/apply/automerge behavior.

Tests use mocked Git runners and do not execute real Git.

## Future Path

The next layer can package the local commit for PR review without pushing or creating a PR automatically.
