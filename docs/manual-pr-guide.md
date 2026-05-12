# Manual PR Creation Guide

The Manual PR Creation Guide converts a ready PR Package into an operator-facing handoff for manual remote action.

Principle:

```text
the system prepares; the operator decides
```

This layer is artifact-only. It does not run Git commands, push, create PRs, run `gh`, call GitHub APIs, mutate source files, or change scheduler/apply/automerge behavior.

## CLI

```bash
pnpm run manual-pr-guide -- \
  --pr-package results/pr-package/pr-package.json \
  --branch-intent results/branch-creation-intent/branch-creation-intent.json \
  --commit-execution results/commit-guarded-executor/commit-guarded-execution.json \
  --output-root results/manual-pr-guide
```

Output:

- `manual-pr-guide.json`
- `manual-pr-guide.md`

## Ready Criteria

The guide is ready only when:

- PR package status is `ready`
- branch creation intent status is `ready`
- branch name is present
- guarded commit execution status is `committed`
- commit hash is present
- PR title and body are present

Blocked and needs-review states fail closed or propagate.

## Guide Contents

The guide includes:

- manual review steps
- pre-push checklist
- risk acceptance checklist
- rollback steps
- do-not-do safety list
- prepared PR title and body

The do-not-do list always includes:

- do not push without final operator review
- do not create PR without reviewing body
- do not bypass validation
- do not merge automatically

## Safety Boundary

D10 bridges governed local work to manual remote action. It does not perform remote action.

No push, PR creation, GitHub API calls, GitHub CLI calls, source mutation, repair dispatch, scheduler mutation, apply mutation, or automerge mutation occurs.

## Why D11 Is Deferred

Guarded PR creation is intentionally deferred because remote mutation needs a stronger operator approval model, final preflight checks, and rollback story. D10 keeps the contract clear: the system prepares; the operator decides.
