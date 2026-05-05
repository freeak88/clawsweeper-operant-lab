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

## v0.5 — Adaptive Scheduler Runtime

Opt-in capacity tuning based on scheduler recommendations.

## v0.6 — Confidence-Gated Actions

Carefully test confidence-gated apply/automerge behavior behind strict flags.
