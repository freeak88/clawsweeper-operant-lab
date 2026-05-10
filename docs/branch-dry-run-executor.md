# Guarded Branch Creation Dry-run Executor

The Guarded Branch Creation Dry-run Executor is the D2 Camino D layer. It
converts a ready dry-run branch creation intent into a deterministic command
preview for operator review.

It does not execute the command.

## Purpose

D1 answers whether a branch creation intent is structurally safe. D2 prepares
the exact command that a future guarded/manual flow could review:

```text
branch creation intent
→ guarded dry-run executor
→ allowed command preview
→ operator execution review
```

## CLI

```bash
pnpm run branch-dry-run-executor -- \
  --branch-intent results/branch-creation-intent/branch-creation-intent.json \
  --output-root results/branch-dry-run-executor
```

The command writes:

```text
results/branch-dry-run-executor/
  branch-dry-run-executor.json
  branch-dry-run-executor.md
```

## Output

The JSON artifact has this shape:

```json
{
  "execution_preview_id": "branch-dry-run-branch-intent-example",
  "branch_intent_id": "branch-intent-example",
  "status": "ready",
  "allowed_command_preview": "git checkout -b \"operator/example\" \"main\"",
  "would_execute": false,
  "safety_checks": [],
  "recommended_next_step": "operator_execution_review",
  "blocked_reason": null
}
```

`would_execute` is always `false`.

## Rules

- Only ready branch intents can produce ready command previews.
- `needs_review` branch intents stay `needs_review`.
- `blocked` branch intents stay blocked.
- The command preview is deterministic.
- Branch and base refs are sanitized and quoted.
- Protected branch names remain blocked:
  - `main`
  - `master`
  - `develop`
  - `release/*`
  - `hotfix/*`

## Safety Boundary

D2 is artifact-only and dry-run only.

It does not:

- execute git commands
- create branches
- run checkout
- create commits
- push
- create PRs
- call the GitHub API
- mutate source files
- change scheduler, apply, or automerge behavior

## Future Path

A future Camino D layer may add a separately approved guarded execution path.
That layer must preserve the same safety gates and make the operator decision
explicit before any mutation is allowed.
