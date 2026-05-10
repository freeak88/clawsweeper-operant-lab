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

## v0.8 — Autonomous Improvement Loop

Implemented:

- Operational weakness detection from local planning/status-like and Operant Lab signals
- Structured improvement proposals for scheduler, routing, policy, memory, review, and repair categories
- Deterministic shadow simulations for hypothetical impact estimates
- Proposal-ready guarded PR suggestions without creating PRs
- No GitHub mutation, autonomous merge, scheduler mutation, repair dispatch, runtime self-modification, or apply/automerge behavior change

## v0.9 — Operator Approval Gate

Implemented:

- Explicit operator approval records for improvement proposals
- Planning-only approval scope: `implementation_plan_only`
- Local implementation plan artifacts with steps, likely files, tests, rollback, and safety constraints
- Blocked outputs for missing, invalid, false, mismatched, or wrong-scope approvals
- No PR creation, GitHub mutation, merge, scheduler/apply/automerge change, or repair dispatch

## v1.0 — Supervised Implementation Writer

Implemented:

- Deterministic Codex-ready prompt generation from approved implementation plans
- Markdown and JSON implementation prompt artifacts
- Blocked output for non-approved, wrong-scope, missing, or malformed plans
- Prompt sections for goal, context, scope, files, steps, tests, rollback, safety, non-goals, and final response requirements
- No code execution, commit creation, PR creation, push, GitHub mutation, repair dispatch, or scheduler/apply/automerge behavior change

## A1 — Supervised Patch Generation

Implemented:

- Deterministic patch proposal generation from approved implementation plans
- Markdown and JSON patch proposal artifacts
- Optional implementation prompt context ingestion
- Blocked output for missing, malformed, blocked, wrong-scope, or non-approved plans
- No patch application, source mutation, commit creation, PR creation, push, merge, GitHub mutation, repair dispatch, or scheduler/apply/automerge behavior change

## A2 — Patch Proposal Validation

Implemented:

- Artifact-only validation for `patch-proposal.json`
- Markdown and JSON validation reports
- Blocking checks for missing tests, rollback, safety constraints, and required non-goals
- Sensitive path detection with `needs_review` status
- No patch application, source mutation, commit creation, PR creation, push, merge, GitHub mutation, repair dispatch, or scheduler/apply/automerge behavior change

## A3 — Shadow Patch Execution

Implemented:

- Deterministic shadow execution reports for validated patch proposals
- Simulation of intended changes, proposed files, and tests without applying diffs or running tests
- `simulated`, `needs_review`, and `blocked` outputs based on Patch Proposal Validation status
- Markdown and JSON shadow execution artifacts
- No patch application, source mutation, test execution, commit creation, PR creation, push, merge, GitHub mutation, repair dispatch, or scheduler/apply/automerge behavior change

## A4 — Operator-approved PR Creation Intent

Implemented:

- Deterministic PR creation intent artifacts from patch proposal, validation, shadow execution, and explicit operator approval
- `ready`, `needs_review`, and `blocked` outputs
- Required `pr_creation_intent_only` approval scope
- Reviewable branch name, PR title, PR body, expected files, tests, and safety constraints
- No branch creation, commit creation, push, PR creation, merge, GitHub mutation, patch application, source mutation, repair dispatch, or scheduler/apply/automerge behavior change

## A5 — Supervised Patch Pipeline Demo

Implemented:

- Synthetic artifact-only integration demo for the supervised patch pipeline
- End-to-end execution of approval gate, patch generation, patch validation, shadow patch execution, and PR creation intent
- Happy path, blocked approval path, and needs-review validation path scenarios
- Unified Markdown and JSON report output
- No GitHub mutation, branch creation, commit creation, push, PR creation, patch application, source mutation, repair dispatch, or scheduler/apply/automerge behavior change

## Camino C — Operator Governance Dashboard

Implemented:

- Read-only cockpit for the Operant Lab artifact stack
- Principle: `Evidence → Proposal → Approval → Simulation → Intent`
- Layer summaries for evidence, proposal, approval, simulation, intent, and safety stages
- Deterministic next-safe-action computation
- Explicit safety posture with all mutation paths false
- No GitHub API calls, GitHub mutation, branch creation, commit creation, push, PR creation, scheduler mutation, or apply/automerge mutation

## D1 — Dry-run Branch Creation Intent

Implemented:

- Artifact-only branch creation intent from a ready PR Creation Intent
- Deterministic sanitized branch names and explicit base refs
- Protected branch blocking for `main`, `master`, `develop`, `release/*`, and `hotfix/*`
- Optional local refs collision detection
- Manual next-step output for branch creation review
- No branch creation, checkout, commit creation, push, PR creation, GitHub API calls, source mutation, or scheduler/apply/automerge behavior change

## D2 — Guarded Branch Creation Dry-run Executor

Implemented:

- Artifact-only guarded command preview from a ready branch creation intent
- Deterministic sanitized and quoted `git checkout -b` preview
- Required `would_execute: false` output
- Ready, blocked, and needs-review status preservation from the source intent
- Protected branch blocking for `main`, `master`, `develop`, `release/*`, and `hotfix/*`
- Operator execution review as the next safe step
- No git execution, branch creation, checkout, commit creation, push, PR creation, GitHub API calls, source mutation, or scheduler/apply/automerge behavior change

## D3 — Guarded Local Branch Creation

Implemented:

- Default dry-run local branch creation executor
- Explicit `--execute` gate for the first local Git branch metadata mutation
- Branch intent and dry-run preview cross-checking
- Deterministic command matching against the approved preview
- Clean working tree, base ref, existing branch, and current branch checks
- Mandatory rollback instruction output
- Git runner dependency injection so tests do not execute real Git
- No push, commit creation, PR creation, GitHub API calls, source mutation beyond local branch metadata, or scheduler/apply/automerge behavior change

## D4 — Isolated Patch Application

Implemented:

- Default dry-run isolated patch application
- Explicit `--execute` gate for isolated workspace application
- Patch proposal, patch validation, and guarded branch execution cross-checking
- Isolated workspace path checks to keep application outside the main repository
- Dependency-injected filesystem/patch runner so tests do not modify real files
- Simulated files, applied files, diff report, and rollback instruction output
- No patch application to the main working tree, commit creation, push, PR creation, GitHub API calls, or scheduler/apply/automerge behavior change

## D5 — Local Validation Runner

Implemented:

- Default dry-run validation runner for isolated patch workspaces
- Explicit `--execute` gate for local validation commands
- Isolated workspace requirement; main working tree validation is blocked
- Validation command allowlist for build, tests, oxlint, and oxfmt checks
- Denylist for Git, GitHub CLI/API, network, destructive, shell, SSH, SCP, and publish commands
- Dependency-injected command runner so tests do not run real commands
- Passed, failed, blocked, needs-review, and dry-run result artifacts
- No commit creation, push, PR creation, GitHub API calls, or scheduler/apply/automerge behavior change

## D6 — Commit Intent

Implemented:

- Reviewable commit intent package from passed isolated validation
- Deterministic conventional commit message proposal
- Expected files from patch proposal artifacts
- Validation evidence from passed local validation commands
- Rollback note from isolated application and patch rollback plan
- Ready, blocked, and needs-review status handling
- No staging, commit creation, push, PR creation, GitHub API calls, source mutation, or scheduler/apply/automerge behavior change
