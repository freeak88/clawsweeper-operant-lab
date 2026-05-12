# ClawSweeper Operant Lab

ClawSweeper Operant Lab is an experimental fork of ClawSweeper focused on conservative autonomous maintenance intelligence. It turns repeated review and repair signals from durable ClawSweeper records into reviewable policies, dry-run evaluations, shadow metrics, and a minimal guarded execution path.

This repository is not a replacement for ClawSweeper production behavior. It is a lab for testing how an already conservative maintenance bot can learn from its own history while staying proposal-first, dry-run-first, and auditable.

## What It Solves

Large maintenance bots repeatedly see the same operational patterns: stale labels, recurring repair causes, repeated verdicts, predictable conflict types, and safe-close evidence. Without a formal layer, that knowledge stays buried in reports and comments.

Operant Lab adds a structured pipeline:

```text
records -> review memory -> policy RFC -> promotion -> policy DSL -> shadow runtime -> metrics -> guarded execution
```

The goal is to make repeated operational knowledge inspectable before it can ever affect live behavior.

## Version Timeline

- `v0.1-operant-lab`: Operant layer foundation with Policy RFC generation, Priority Engine, Review Memory, Model Routing metadata, Adaptive Scheduler recommendations, and Confidence Engine.
- `v0.2-policy-promotion`: RFC Promotion Pipeline with Draft -> Candidate -> Approved lifecycle state.
- `v0.3-policy-dsl-dry-run`: Executable Policy DSL Dry-Run for deterministic approved policy rules.
- `v0.4-shadow-runtime`: Shadow Runtime Reports for running approved DSL rules against Review Memory without executing actions.
- `v0.5-shadow-metrics`: Shadow Accuracy Metrics for policy-level confidence, risk, blocked, and candidate signals.
- `v0.6-guarded-execution`: Minimal guarded execution safe mode, limited to local `annotate_only` and `suggest_comment` decisions.
- `v0.7-demo-report`: Local Demo Report Generator for producing Markdown and JSON reports from repository input and local records only.

Validation notes live in [`docs/validation/`](docs/validation/).

## Safety Model

Operant Lab is designed around conservative gates:

- Default OFF.
- Proposal-first.
- Dry-run first.
- No GitHub mutation by default.
- No automatic issue closing.
- No automatic PR merging.
- No automatic repair dispatch.
- No scheduler, apply, or automerge behavior changes by default.
- Guarded execution supports only `annotate_only` and `suggest_comment`.
- Guarded execution requires `CLAWSWEEPER_ENABLE_GUARDED_EXECUTION=1`.
- Guarded execution logs every decision under `results/guarded-execution/`.

Explicitly unsupported in v0.6:

- closing issues
- merging PRs
- dispatching repairs
- modifying repository state
- changing ClawSweeper scheduler/apply/automerge behavior

## Quickstart

Requires Node 24 and pnpm 10.33.2.

```bash
corepack enable
pnpm install
pnpm run build
```

For a local dry-run tour, see [`docs/demo.md`](docs/demo.md).

## Main Commands

Build Review Memory:

```bash
pnpm run review-memory -- --target-repo openclaw/openclaw
```

Generate Policy RFCs:

```bash
pnpm run policy-rfc -- --target-repo openclaw/openclaw
```

Promote a policy proposal:

```bash
pnpm run policy-promote -- --proposal <proposal.json> --to candidate --reason "repeated stable pattern"
pnpm run policy-promote -- --proposal <proposal.json> --to approved --reason "operator approved"
```

Run Policy DSL dry-run:

```bash
pnpm run policy-dsl -- --policy <policy.json> --memory <review-memory.json>
```

Run Shadow Runtime:

```bash
pnpm run shadow-runtime -- --policies <policy-dir> --memory <review-memory.json>
```

Analyze Shadow Metrics:

```bash
pnpm run shadow-metrics -- --reports <shadow-report-dir>
```

Generate a local demo report:

```bash
pnpm run demo-report -- --repo https://github.com/openclaw/openclaw
```

Run Guarded Execution in dry-run mode:

```bash
pnpm run guarded-execution -- \
  --policy <policy.json> \
  --metrics <shadow-metrics.json> \
  --confidence <confidence.json> \
  --item-number 42 \
  --dry-run true
```

Run Guarded Execution safe mode for local annotation decisions:

```bash
CLAWSWEEPER_ENABLE_GUARDED_EXECUTION=1 pnpm run guarded-execution -- \
  --policy <policy.json> \
  --metrics <shadow-metrics.json> \
  --confidence <confidence.json> \
  --item-number 42 \
  --dry-run false
```

## Architecture

The high-level architecture is documented in [`docs/architecture.md`](docs/architecture.md).

## Autonomous Operant Layers

- Priority Engine
- Review Memory
- Policy RFC Engine
- Policy Promotion
- Policy DSL
- Model Routing
- Adaptive Scheduler
- Confidence Engine
- Shadow Runtime
- Guarded Execution
- Demo Report Generator
- Autonomous Improvement Loop
- Operator Approval Gate
- Supervised Implementation Writer
- Supervised Patch Generation
- Patch Proposal Validation
- Shadow Patch Execution
- Operator-approved PR Creation Intent
- Supervised Patch Pipeline Demo
- Operator Governance Dashboard
- Dry-run Branch Creation Intent
- Guarded Branch Creation Dry-run Executor
- Guarded Local Branch Creation
- Isolated Patch Application
- Local Validation Runner
- Commit Intent
- Guarded Commit Dry-run Executor
- Guarded Local Commit Execution
- PR Package Generation
- Manual PR Creation Guide

Core modules:

- [`docs/review-memory.md`](docs/review-memory.md)
- [`docs/policy-rfc-engine.md`](docs/policy-rfc-engine.md)
- [`docs/policy-promotion.md`](docs/policy-promotion.md)
- [`docs/policy-dsl.md`](docs/policy-dsl.md)
- [`docs/shadow-runtime.md`](docs/shadow-runtime.md)
- [`docs/shadow-metrics.md`](docs/shadow-metrics.md)
- [`docs/guarded-execution.md`](docs/guarded-execution.md)
- [`docs/demo-report.md`](docs/demo-report.md)
- [`docs/improvement-loop.md`](docs/improvement-loop.md)
- [`docs/approval-gate.md`](docs/approval-gate.md)
- [`docs/implementation-writer.md`](docs/implementation-writer.md)
- [`docs/patch-generation.md`](docs/patch-generation.md)
- [`docs/patch-validation.md`](docs/patch-validation.md)
- [`docs/shadow-patch-execution.md`](docs/shadow-patch-execution.md)
- [`docs/pr-creation-intent.md`](docs/pr-creation-intent.md)
- [`docs/supervised-patch-pipeline-demo.md`](docs/supervised-patch-pipeline-demo.md)
- [`docs/governance-dashboard.md`](docs/governance-dashboard.md)
- [`docs/branch-creation-intent.md`](docs/branch-creation-intent.md)
- [`docs/branch-dry-run-executor.md`](docs/branch-dry-run-executor.md)
- [`docs/branch-guarded-executor.md`](docs/branch-guarded-executor.md)
- [`docs/isolated-patch-application.md`](docs/isolated-patch-application.md)
- [`docs/local-validation-runner.md`](docs/local-validation-runner.md)
- [`docs/commit-intent.md`](docs/commit-intent.md)
- [`docs/commit-dry-run-executor.md`](docs/commit-dry-run-executor.md)
- [`docs/commit-guarded-executor.md`](docs/commit-guarded-executor.md)
- [`docs/pr-package.md`](docs/pr-package.md)
- [`docs/manual-pr-guide.md`](docs/manual-pr-guide.md)
- [`docs/confidence-engine.md`](docs/confidence-engine.md)
- [`docs/priority-engine.md`](docs/priority-engine.md)
- [`docs/model-routing.md`](docs/model-routing.md)
- [`docs/adaptive-scheduler.md`](docs/adaptive-scheduler.md)

Original ClawSweeper operational docs remain available under [`docs/`](docs/), including scheduler and repair internals.

## Current Limitations

- Guarded execution does not publish GitHub comments; it writes local decision logs only.
- Only `annotate_only` and `suggest_comment` are allowed in guarded execution.
- Policy DSL execution remains dry-run/reporting-first.
- Promotion requires explicit operator intent.
- Shadow metrics identify candidates; they do not promote or execute policies.
- Demo reports read local records only and make no GitHub API calls.
- The lab does not change default ClawSweeper scheduler, apply, automerge, repair, or GitHub mutation paths.
- Historical data quality depends on available durable records and generated state.

## Roadmap

Near-term work should stay conservative:

- richer sample fixtures and demo datasets
- operator review UI or report bundles for promoted policies
- stricter schema validation for policy DSL and confidence inputs
- optional comment-publication experiments behind separate flags
- manual approval gates before any broader guarded execution
- continued proof that scheduler/apply/automerge behavior remains unchanged unless explicitly wired

The detailed roadmap is in [`docs/roadmap.md`](docs/roadmap.md).
