# Shadow Patch Execution

Shadow Patch Execution is an artifact-only simulation layer for patch proposals
that already passed Patch Proposal Validation.

It answers one narrow question:

> If an operator later chose to turn this validated patch proposal into a real
> implementation step, what changes and tests would be involved?

It does not apply patches, edit source files, run tests, create commits, create
PRs, push branches, mutate GitHub, dispatch repairs, or change
scheduler/apply/automerge behavior.

## Inputs

- `patch-proposal.json` from Supervised Patch Generation
- `patch-validation.json` from Patch Proposal Validation

Only validation records with `status: "valid"` produce simulated output.

Validation records with `status: "needs_review"` produce a needs-review report.
Validation records with `status: "blocked"` produce a blocked report.

## CLI Usage

```bash
pnpm run shadow-patch-execution -- --patch results/patch-generation/patch-proposal.json --validation results/patch-validation/patch-validation.json --output-root results/shadow-patch-execution
```

Outputs:

- `shadow-patch-execution.json`
- `shadow-patch-execution.md`

## Output

```json
{
  "shadow_execution_id": "shadow-patch-plan-example",
  "patch_id": "patch-plan-example",
  "status": "simulated",
  "simulated_changes": [],
  "simulated_tests": [],
  "risk_notes": [],
  "recommended_next_step": "eligible_for_operator_pr_creation",
  "summary": "Patch proposal shadow simulation completed without applying changes."
}
```

`simulated_changes` mirrors intended changes and proposed file paths with
`applied: false`.

`simulated_tests` mirrors `tests_to_run` with `executed: false`.

## Validation vs. Shadow Execution

Patch Proposal Validation checks whether a patch proposal has enough structure,
safety constraints, rollback, tests, and non-goals to proceed.

Shadow Patch Execution does not validate again. It consumes the validation
decision and turns a valid proposal into a deterministic simulation report.

## Safety Boundary

- No patch application.
- No source modification.
- No real test execution.
- No GitHub API calls.
- No GitHub mutation.
- No commits, pushes, PRs, merges, or repair dispatch.
- No scheduler/apply/automerge behavior changes.

## Future Path

A future operator-approved PR creation layer may consume this report to prepare
human-reviewable implementation work. That future layer should remain explicit,
audited, and separate from scheduler/apply/automerge runtime behavior.
