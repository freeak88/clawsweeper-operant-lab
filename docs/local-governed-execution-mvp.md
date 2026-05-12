# Local Governed Execution MVP

Local Governed Execution MVP is the current maturity phase of ClawSweeper Operant Lab.

It proves that an AI maintenance system can prepare, constrain, simulate, validate, execute locally, and explain software changes without taking remote authority away from humans.

Principle:

```text
The system can prepare and constrain action,
but humans retain operational authority.
```

## Scope

The MVP covers local governed change preparation:

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

It can:

- read durable maintenance evidence
- generate policy and improvement proposals
- record explicit approvals
- simulate outcomes
- prepare intents
- create guarded local branches with explicit execution
- apply patches in isolated workspaces
- run allowlisted validation in isolated workspaces
- prepare commit intent and command previews
- create a guarded local commit with explicit execution
- generate a PR package
- generate a manual PR creation guide

It does not:

- push
- create remote branches
- create PRs
- merge
- mutate GitHub
- deploy
- change scheduler/apply/automerge behavior

## Current Maturity

Current phase:

```text
Local Governed Execution MVP
```

Current capabilities:

- local governed execution
- isolated patch application
- local validation
- guarded local commit
- PR package generation
- manual remote-action preparation

Intentionally deferred:

- autonomous merge
- unattended remote mutation
- remote PR creation
- GitHub mutation without explicit approval
- self-modifying execution policy

## Operational Boundaries

Remote consequences are operator-owned.

The system may generate:

- evidence reports
- proposals
- approval artifacts
- simulation reports
- intents
- local execution logs
- PR packages
- manual guides

The system must not silently perform:

- GitHub API mutation
- remote branch push
- PR creation
- merge
- production deployment
- scheduler/apply/automerge mutation

## Threat Model

### Unintended Mutation

Risk: the system changes files, branches, commits, or remote state outside operator intent.

Mitigations:

- default dry-run
- explicit `--execute` gates
- expected-file constraints
- isolated patch application
- scoped command allowlists
- no remote mutation paths in local MVP

### Hidden Remote Action

Risk: a local workflow secretly pushes, creates a PR, calls GitHub, or changes production state.

Mitigations:

- no GitHub API calls in remote-preparation layers
- no `gh` execution in PR package or manual guide layers
- PR package and manual guide are artifact-only
- remote action is documented as operator-owned

### Unsafe Autonomous Execution

Risk: the agent skips proposal, approval, simulation, or validation.

Mitigations:

- proposal-first pipeline
- approval artifacts
- shadow simulation
- confidence and risk surfaces
- guarded local execution only after intent and preview

### Non-Deterministic Execution

Risk: repeated inputs produce different plans, messages, package bodies, or decisions.

Mitigations:

- deterministic IDs
- sorted arrays
- stable JSON output
- test fixtures with fixed expectations

### Rollback Absence

Risk: an operator cannot unwind local action.

Mitigations:

- rollback instructions in branch, patch, commit, PR package, and manual guide artifacts
- guarded commit rollback uses `git reset --soft HEAD~1`
- isolated patch rollback uses workspace removal

### Approval Bypass

Risk: a system step promotes itself into action without an operator decision.

Mitigations:

- approval records
- status propagation for blocked and needs-review states
- explicit execution flags
- manual remote action boundary

### Operator Ambiguity

Risk: a human does not understand what happened, what remains blocked, or what they own.

Mitigations:

- governance dashboard
- PR package
- manual PR guide
- operator checklists
- do-not-do lists
- safety statements in generated Markdown

## Safety Posture

The MVP is designed around this stance:

```text
The system prepares;
the operator decides.
```

It demonstrates local governed execution without crossing into unattended remote mutation.
