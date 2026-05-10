# Operator Governance Dashboard

The Operator Governance Dashboard is a read-only cockpit for the Operant Lab.
It summarizes the latest available local artifacts across the conservative
autonomy stack.

Principle:

```text
Evidence → Proposal → Approval → Simulation → Intent
```

## Purpose

The dashboard answers the operator questions that matter before any future
mutation path exists:

- What did it observe?
- What did it propose?
- Who or what approved it?
- What did simulation predict?
- What does it intend to do?
- What blocks action?
- What is the next safe step?

## Inputs

The collector scans a local artifact root for known JSON outputs from:

- Review Memory
- Policy RFCs
- Policy Promotion
- Policy DSL
- Shadow Runtime
- Shadow Metrics
- Confidence
- Guarded Execution
- Improvement Loop
- Approval Gate
- Implementation Writer
- Patch Generation
- Patch Validation
- Shadow Patch Execution
- PR Creation Intent
- Supervised Patch Pipeline Demo

Missing artifacts are represented as `missing`; malformed JSON is skipped
without crashing the dashboard.

## CLI Usage

```bash
pnpm run governance-dashboard -- --input-root results --output-root results/governance-dashboard --generated-at 2026-05-09T12:00:00.000Z
```

Outputs:

- `governance-dashboard.md`
- `governance-dashboard.json`

## Safety Boundary

- Read-only.
- Artifact-only.
- No GitHub API calls.
- No GitHub mutation.
- No scheduler/apply/automerge changes.
- No branch creation.
- No commit.
- No push.
- No PR creation.

## Camino D Preparation

The dashboard does not enable mutation. It prepares Camino D by making the
governance state explicit: evidence, proposals, approvals, simulations, intents,
blocks, and next safe actions are all visible before any supervised execution
path is considered.
