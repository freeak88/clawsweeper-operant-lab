# Safety Guarantees

ClawSweeper Operant Lab is built around governed autonomy rather than unrestricted autonomy.

The objective is:

```text
not more autonomy;
more operational legibility.
```

## Core Guarantee

The system can prepare and constrain action, but humans retain operational authority.

## Operational Guarantees

### Default Dry-run

Execution-capable layers default to dry-run behavior. They produce artifacts unless explicitly invoked with an execution flag.

### Explicit Execution Gates

Local mutation requires explicit `--execute` where supported.

No layer should infer permission to execute from the existence of a proposal, approval, or package alone.

### Isolated Execution

Patch application happens in an isolated workspace, not directly in the main working tree.

### Deterministic Outputs

Generated artifacts use stable ordering and deterministic content so operators can review diffs and audit changes.

### Approval Boundaries

Approval artifacts authorize only the next intended scope.

Examples:

- approval for planning does not authorize code changes
- approval for PR creation intent does not create a PR
- local guarded commit does not authorize push

### Rollback Generation

Local action layers include rollback instructions.

Examples:

- delete a local branch
- remove an isolated workspace
- run `git reset --soft HEAD~1`

### Human-Reviewed Remote Action

Remote action remains human-owned in the current MVP.

The manual PR guide prepares the operator, but does not push or create a PR.

### No Hidden Mutation

Artifact-only layers do not run Git, `gh`, GitHub API calls, network calls, or destructive commands.

### Auditable Artifacts

Each layer produces reviewable Markdown and/or JSON artifacts that explain:

- inputs
- status
- evidence
- blocked reasons
- next safe step
- rollback path

### Constrained Execution Boundaries

Execution-capable layers are constrained by:

- ready status checks
- matching dry-run preview
- expected file lists
- allowlisted commands
- mocked runners in tests
- explicit no-push/no-PR/no-GitHub boundaries

## Intentionally Not Automated

The following remain intentionally deferred:

- autonomous merge
- unattended remote mutation
- remote PR creation
- autonomous remote push
- hidden GitHub actions
- production deployment automation
- self-modifying execution policies
- GitHub mutation without explicit future approval

These boundaries are part of the product's trust model.
