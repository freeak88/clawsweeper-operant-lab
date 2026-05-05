# ClawSweeper Operant Lab Roadmap

## v0.1 — Operant Layer Foundation

Implemented:

- Policy RFC Engine
- Priority Engine
- Priority-assisted planner
- Review Memory
- Model Routing metadata
- Adaptive Scheduler recommendations
- Confidence Engine

## v0.2 — RFC Promotion Pipeline

Implemented:

- Draft → Candidate → Approved lifecycle
- Rejected and Superseded terminal states
- Immutable promotion event records
- Local CLI promotion command
- Proposal-only state output

Validation:

- Tag: `v0.2-policy-promotion`
- Commit: `320a5684de4b50de8499837316b2f10a17a7bcbd`
- Runtime: Node `v24.15.0`, pnpm `10.33.2`
- `pnpm run build` and `pnpm run build:all` passed.
- All new-layer tests passed.
- Observed full-suite failures in this local Windows/Node 24 validation run are
  tracked in [`validation/v0.2-policy-promotion.md`](validation/v0.2-policy-promotion.md).
- No scheduler, apply, automerge, repair dispatch, or GitHub mutation behavior
  was changed.

## v0.3 — Executable Policy DSL Dry-Run

Implemented:

- Deterministic JSON policy DSL for approved policies
- Dry-run evaluator for review-memory or record-derived item objects
- Local CLI command for historical evaluation
- Dry-run reports under `results/policy-dsl-dry-run/`
- No policy execution or scheduler/apply/automerge mutation wiring

## v0.4 — Shadow Runtime Reports

Implemented:

- Approved Policy DSL rules evaluated against Review Memory records
- Reporting-only shadow matches and action counts
- Confidence metadata attached to would-propose matches
- Local CLI command for shadow report generation
- No policy execution or scheduler/apply/automerge mutation wiring

## v0.5 — Shadow Accuracy Metrics

Implemented:

- Shadow Runtime reports aggregated into policy-level metrics
- Confidence averages, blocked counts, risk counts, and action counts
- Conservative guarded-execution candidate flag and reason
- Local CLI command for metrics generation
- No policy execution or scheduler/apply/automerge mutation wiring

## v0.6 — Guarded Execution

Implemented:

- Minimal opt-in guarded execution engine
- `CLAWSWEEPER_ENABLE_GUARDED_EXECUTION=1` safety flag
- Dry-run support for every decision
- Local decision logs under `results/guarded-execution/`
- Allowed actions limited to `annotate_only` and `suggest_comment`
- No GitHub mutation, issue closing, PR merging, repair dispatch, or scheduler/apply/automerge behavior change

## v0.7 — Demo Report Generator

Implemented:

- Local report generator from GitHub repo input
- Repository normalization for HTTPS, SSH, and `owner/repo` forms
- Local-records-only orchestration of Review Memory, Policy RFC, Policy DSL, Shadow Runtime, and Shadow Metrics artifacts
- Markdown and JSON report output under `results/demo-report/<repo-slug>/`
- No GitHub API calls, guarded execution, issue closing, PR merging, repair dispatch, or scheduler/apply/automerge behavior change
