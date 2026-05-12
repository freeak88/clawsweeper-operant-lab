# Operational Walkthrough

This walkthrough explains the end-to-end Local Governed Execution MVP from an operator perspective.

The goal is not to show that the system can act without control.

The goal is to show that the system prepares action under control.

## Principle

```text
The system prepares;
the operator decides.
```

## End-to-End Flow

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

## 1. Evidence

Durable records, repair markers, prior outcomes, generated state, and review memory become the evidence base.

Operator question:

```text
What did the system observe?
```

## 2. Proposal

Policy RFCs, improvement proposals, patch proposals, and generated plans translate evidence into reviewable possibilities.

Operator question:

```text
What is being proposed, and why?
```

## 3. Approval

Approval artifacts explicitly define scope.

Approval for one scope does not authorize another.

Operator question:

```text
Who approved what, and for which boundary?
```

## 4. Simulation

Shadow runtime, shadow metrics, shadow patch execution, and dry-run executors show what would happen before anything is applied.

Operator question:

```text
What would the system do if allowed?
```

## 5. Intent

Intent layers turn simulated actions into constrained, reviewable packages.

Examples:

- branch creation intent
- PR creation intent
- commit intent

Operator question:

```text
What action is intended, and what blocks it?
```

## 6. Governance

The governance dashboard and generated artifacts provide a cockpit for status, blocks, evidence counts, and next safe actions.

Operator question:

```text
Is the system ready to proceed, blocked, or waiting for review?
```

## 7. Guarded Local Branch

Branch creation moves from intent to dry-run preview to guarded local execution.

Execution requires explicit `--execute`.

No push or GitHub mutation occurs.

## 8. Isolated Apply

Patch application happens only in an isolated workspace.

The main working tree is not patched directly.

## 9. Local Validation

Validation runs only allowlisted commands against the isolated workspace.

Disallowed commands include GitHub CLI/API, network calls, destructive commands, and publish operations.

## 10. Commit Intent

Passed validation becomes a reviewable commit package.

It contains expected files, validation evidence, rollback notes, and a deterministic conventional commit message.

## 11. Commit Preview

The dry-run executor shows the exact allowed `git add` and `git commit -m` previews.

It does not stage or commit.

## 12. Guarded Commit

The guarded commit executor may create a local commit only with explicit `--execute`, matching preview, ready inputs, and expected-file-only changes.

It does not push, create PRs, or call GitHub.

## 13. PR Package

The PR package turns local execution into communication:

- title
- body
- diff summary
- validation evidence
- rollback plan
- risk notes
- operator checklist

## 14. Manual PR Guide

The manual guide tells the operator what to review before any remote action.

It includes:

- branch name
- commit hash
- PR title/body
- pre-push checklist
- risk acceptance checklist
- rollback steps
- do-not-do list

The guide does not push or create a PR.

## What Actually Remains Human-Owned

- remote branch push
- PR creation
- merge
- production deployment
- accepting operational risk

## Summary

The system prepares, constrains, simulates, validates, and explains.

The operator decides whether remote consequences happen.
