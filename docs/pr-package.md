# PR Package Generation

The PR Package Generator converts a guarded local commit execution into reviewable human-facing PR material.

It is artifact-only. It does not push, create PRs, run `gh`, call GitHub APIs, mutate source files, or change scheduler/apply/automerge behavior.

## Flow

```text
guarded local commit
→ PR package
→ title/body
→ diff summary
→ evidence
→ rollback
→ checklist
→ human review
```

## CLI

```bash
pnpm run pr-package -- \
  --commit-execution results/commit-guarded-executor/commit-guarded-execution.json \
  --commit-intent results/commit-intent/commit-intent.json \
  --validation results/local-validation-runner/local-validation-result.json \
  --application results/isolated-patch-application/isolated-patch-application.json \
  --patch results/patch-generation/patch-proposal.json \
  --output-root results/pr-package
```

Output:

- `pr-package.json`
- `pr-package.md`

## Ready Criteria

The generator produces a ready package only when:

- guarded commit execution status is `committed`
- commit hash is present
- commit intent is ready
- local validation passed
- validation evidence exists
- isolated patch application was applied in isolation
- rollback instruction exists
- patch proposal is `patch_proposed`

Dry-run, blocked, or malformed inputs fail closed. Needs-review inputs propagate needs-review.

## Package Contents

The generated PR package includes:

- deterministic title
- PR body
- changed files and diff summary
- validation evidence
- rollback plan
- risk notes
- operator checklist
- explicit safety statement

## Safety Boundary

D9 communicates what happened. It does not perform remote action.

No push, PR creation, GitHub API calls, source mutation, repair dispatch, scheduler mutation, apply mutation, or automerge mutation occurs.

## Future Path

A future guarded PR creation layer may consume this package, but should still require explicit operator approval before any remote action.
