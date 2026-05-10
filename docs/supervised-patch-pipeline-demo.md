# Supervised Patch Pipeline Demo

The Supervised Patch Pipeline Demo runs the safe Camino A chain with synthetic
inputs and writes a single Markdown and JSON report.

Pipeline:

```text
approval-gate
-> patch-generation
-> patch-validation
-> shadow-patch-execution
-> pr-creation-intent
```

The demo is artifact-only. It does not create branches, create commits, push,
create PRs, apply patches, modify source files from generated proposals, mutate
GitHub, dispatch repairs, or change scheduler/apply/automerge behavior.

## CLI Usage

```bash
pnpm run supervised-patch-pipeline-demo -- --output-root results/supervised-patch-pipeline-demo
```

Optional synthetic scenarios:

```bash
pnpm run supervised-patch-pipeline-demo -- --output-root results/supervised-patch-pipeline-demo --scenario happy_path
pnpm run supervised-patch-pipeline-demo -- --output-root results/supervised-patch-pipeline-demo --scenario blocked_approval
pnpm run supervised-patch-pipeline-demo -- --output-root results/supervised-patch-pipeline-demo --scenario needs_review_validation
```

Outputs:

- `supervised-patch-pipeline-demo.json`
- `supervised-patch-pipeline-demo.md`

## Why This Exists

The individual Camino A layers are intentionally narrow. This demo shows the
whole supervised flow as one operator-readable report:

- an improvement proposal is approved for planning
- a patch proposal is generated
- the proposal is validated
- a shadow execution is simulated
- an explicit PR creation intent is prepared

Even the happy path stops at intent. A human/operator still decides whether to
create a branch or PR outside this system.

## Safety Boundary

- No GitHub mutation.
- No branch creation.
- No commits.
- No push.
- No PR creation.
- No patch application.
- No source mutation.
- No scheduler/apply/automerge behavior changes.
