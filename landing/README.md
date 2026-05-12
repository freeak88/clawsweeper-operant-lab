# Landing Surface Draft

This is a minimal landing/demo surface for ClawSweeper Operant Lab.

It is documentation only. It does not add runtime behavior.

## Hero

```text
Governed AI software operations.
```

Sub:

```text
The system prepares; the operator decides.
```

CTA:

```text
See governed execution flow
```

## Section 1 — Problem

Most AI agents act first and explain later.

```text
agent -> action -> hope
```

Operant Lab is built around governed action:

```text
evidence -> approval -> simulation -> constrained action
```

## Section 2 — Architecture

Four layers:

```text
Cognitive Layer
Governance Layer
Execution Layer
Human Interface Layer
```

Short explanation:

- Cognitive Layer observes, scores, remembers, and classifies.
- Governance Layer approves, simulates, measures, and constrains.
- Execution Layer applies and validates locally under explicit gates.
- Human Interface Layer explains, packages, and prepares operator-owned remote action.

## Section 3 — Operational Flow

```text
Evidence
-> Proposal
-> Approval
-> Simulation
-> Intent
-> Guarded Execution
-> Validation
-> PR Package
-> Manual Guide
```

## Section 4 — Safety Guarantees

- default dry-run
- isolated execution
- rollback generation
- deterministic artifacts
- operator-owned remote action
- no hidden mutation

## Section 5 — Intentionally Not Automated

- no autonomous merge
- no unattended remote mutation
- no hidden GitHub actions
- no self-modifying execution policy
- no remote PR creation in the current MVP

## Closing Line

```text
not more autonomy;
more operational legibility.
```
