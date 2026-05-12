# ClawSweeper Operant Lab

## Governed AI Software Operations

This is not an agent that acts first.

This is a governed runtime that prepares, constrains, simulates, validates, and explains action before humans authorize remote consequences.

ClawSweeper Operant Lab is an experimental fork of ClawSweeper focused on autonomous engineering under operational control. It turns maintenance evidence into proposals, approvals, simulations, guarded local execution, and human-ready review packages.

Core principle:

```text
The system can prepare and constrain action,
but humans retain operational authority.
```

Short positioning:

```text
Governed AI software operations.
```

Medium positioning:

```text
Autonomous engineering under operational control.
```

Long positioning:

```text
A governed autonomous engineering runtime that prepares, validates, simulates, executes, and packages software changes under explicit operational controls.
```

Current phase:

```text
Local Governed Execution MVP
```

Current strategic focus:

```text
not more autonomy;
more operational legibility.
```

## What Problem It Solves

Most AI coding systems optimize for capability first:

```text
agent -> action
```

That creates operational risk: hidden mutation, unclear authority, weak rollback, missing audit trails, and ambiguous responsibility.

Operant Lab optimizes for governed action:

```text
evidence -> proposal -> approval -> simulation -> intent -> guarded local action -> human review
```

The system is designed for teams that want agentic software maintenance without surrendering operational control.

## Why It Is Different

Operant Lab does not try to prove that an agent can act without supervision.

It proves that an agent can prepare action inside explicit boundaries:

- evidence-backed proposals
- deterministic artifacts
- approval records
- shadow simulations
- confidence and risk signals
- isolated patch application
- local validation
- guarded local commit
- rollback instructions
- PR packages and manual guides

The operator remains responsible for remote consequences.

## Architecture Layers

Operant Lab is easiest to understand as four layers:

```text
Cognitive Layer
-> Governance Layer
-> Execution Layer
-> Human Interface Layer
```

### Cognitive Layer

Reads durable maintenance history and generates structured understanding.

- Review Memory
- Priority Engine
- Model Routing metadata
- Adaptive Scheduler recommendations
- Confidence Engine
- Policy RFC Engine

### Governance Layer

Turns understanding into reviewable decisions and simulations.

- Policy Promotion
- Policy DSL
- Shadow Runtime
- Shadow Metrics
- Approval Gate
- Governance Dashboard
- Improvement Loop
- Intent artifacts

### Execution Layer

Allows tightly constrained local action only after previews, approvals, and checks.

- Branch Creation Intent
- Branch Dry-run Executor
- Guarded Local Branch Creation
- Isolated Patch Application
- Local Validation Runner
- Commit Intent
- Commit Dry-run Executor
- Guarded Local Commit Execution

### Human Interface Layer

Explains what happened and prepares human-owned remote action.

- PR Package Generation
- Manual PR Creation Guide
- Demo Report Generator
- Operational walkthroughs

See [docs/architecture.md](docs/architecture.md) for the full diagram.

## Local Governed Execution MVP

The current MVP covers the local governed change lifecycle:

```text
Evidence
-> Proposal
-> Approval
-> Simulation
-> Intent
-> Governance
-> Guarded Branch
-> Isolated Apply
-> Local Validation
-> Commit Intent
-> Commit Preview
-> Guarded Commit
-> PR Package
-> Manual PR Guide
```

The system can prepare and execute a local change under constraints, validate it, create a guarded local commit, and produce a human-ready PR package and manual PR guide.

It does not push, create PRs, merge, mutate GitHub, or perform unattended remote action.

See [docs/local-governed-execution-mvp.md](docs/local-governed-execution-mvp.md).

## Operational Guarantees

Operant Lab is built around conservative guarantees:

- default dry-run behavior
- explicit execution gates
- isolated execution where patches are applied
- deterministic generated artifacts
- approval boundaries
- rollback instructions
- local-only guarded execution
- human-reviewed remote action
- no hidden GitHub mutation
- no scheduler/apply/automerge changes by default

See [docs/safety-guarantees.md](docs/safety-guarantees.md).

## Intentionally Not Automated

These are intentionally deferred:

- autonomous merge
- unattended remote mutation
- remote PR creation
- autonomous remote push
- hidden GitHub actions
- production deployment automation
- self-modifying execution policy
- GitHub mutation without explicit future approval

This is part of the product stance, not a missing feature.

## Quickstart

Requires Node 24 and pnpm 10.33.2.

```bash
corepack enable
pnpm install
pnpm run build
```

Run the local governed execution docs:

- [Architecture](docs/architecture.md)
- [Local Governed Execution MVP](docs/local-governed-execution-mvp.md)
- [Safety Guarantees](docs/safety-guarantees.md)
- [Operational Walkthrough](docs/operational-walkthrough.md)
- [Demo Guide](docs/demo.md)

## Main Commands

Build Review Memory:

```bash
pnpm run review-memory -- --target-repo openclaw/openclaw
```

Generate Policy RFCs:

```bash
pnpm run policy-rfc -- --target-repo openclaw/openclaw
```

Run Shadow Runtime and metrics:

```bash
pnpm run shadow-runtime -- --policies policies --memory results/review-memory/openclaw-openclaw.json
pnpm run shadow-metrics -- --reports results/shadow-runtime/openclaw-openclaw
```

Generate a demo report:

```bash
pnpm run demo-report -- --repo https://github.com/openclaw/openclaw
```

Run governance dashboard:

```bash
pnpm run governance-dashboard -- --input-root results --output-root results/governance-dashboard
```

Run the local execution handoff stages:

```bash
pnpm run branch-creation-intent -- --pr-intent <path> --output-root <path> --base-ref main
pnpm run branch-dry-run-executor -- --branch-intent <path> --output-root <path>
pnpm run branch-guarded-executor -- --branch-intent <path> --preview <path> --output-root <path>
pnpm run isolated-patch-application -- --patch <path> --validation <path> --branch-execution <path> --output-root <path>
pnpm run local-validation-runner -- --application <path> --patch <path> --output-root <path>
pnpm run commit-intent -- --validation <path> --application <path> --patch <path> --output-root <path>
pnpm run commit-dry-run-executor -- --commit-intent <path> --output-root <path>
pnpm run commit-guarded-executor -- --commit-intent <path> --preview <path> --output-root <path>
pnpm run pr-package -- --commit-execution <path> --commit-intent <path> --validation <path> --application <path> --patch <path> --output-root <path>
pnpm run manual-pr-guide -- --pr-package <path> --branch-intent <path> --commit-execution <path> --output-root <path>
```

Commands with execution capability remain dry-run by default and require explicit `--execute`.

## Documentation Map

Product and architecture:

- [Product Consolidation](PRODUCT_CONSOLIDATION.md)
- [Architecture](docs/architecture.md)
- [Local Governed Execution MVP](docs/local-governed-execution-mvp.md)
- [Safety Guarantees](docs/safety-guarantees.md)
- [Operational Walkthrough](docs/operational-walkthrough.md)
- [Governance Dashboard](docs/governance-dashboard.md)

Core layers:

- [Review Memory](docs/review-memory.md)
- [Policy RFC Engine](docs/policy-rfc-engine.md)
- [Policy Promotion](docs/policy-promotion.md)
- [Policy DSL](docs/policy-dsl.md)
- [Shadow Runtime](docs/shadow-runtime.md)
- [Shadow Metrics](docs/shadow-metrics.md)
- [Confidence Engine](docs/confidence-engine.md)
- [Guarded Execution](docs/guarded-execution.md)
- [Branch Creation Intent](docs/branch-creation-intent.md)
- [Isolated Patch Application](docs/isolated-patch-application.md)
- [Local Validation Runner](docs/local-validation-runner.md)
- [Commit Intent](docs/commit-intent.md)
- [Guarded Local Commit Execution](docs/commit-guarded-executor.md)
- [PR Package](docs/pr-package.md)
- [Manual PR Guide](docs/manual-pr-guide.md)

## Current Boundaries

The lab does not change default ClawSweeper scheduler, apply, automerge, repair, or GitHub mutation paths.

Remote action remains operator-owned.

## Roadmap

Near-term work should focus on product clarity and governed remote-intent design, not broadening autonomy.

The next responsible layer is a dry-run Remote Governance Layer:

```text
Manual PR Guide
-> Remote Action Intent
-> Remote Action Dry-run
-> Operator Approval
-> Guarded Remote Action
```

Detailed roadmap: [docs/roadmap.md](docs/roadmap.md).
