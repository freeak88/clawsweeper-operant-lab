# PR Creation Intent

PR Creation Intent converts a validated, successfully shadow-simulated patch
proposal into a human-reviewable PR creation plan.

It does not create a branch, create commits, push, create a PR, merge, apply
patches, modify source files, mutate GitHub, dispatch repairs, or change
scheduler/apply/automerge behavior.

## Inputs

- `patch-proposal.json`
- `patch-validation.json`
- `shadow-patch-execution.json`
- explicit operator approval JSON

Approval must be explicit:

```json
{
  "patch_id": "patch-plan-example",
  "approved": true,
  "approved_by": "operator",
  "approved_at": "2026-05-06T12:00:00.000Z",
  "approval_scope": "pr_creation_intent_only",
  "notes": "Prepare a manual PR plan only."
}
```

## CLI Usage

```bash
pnpm run pr-creation-intent -- --patch results/patch-generation/patch-proposal.json --validation results/patch-validation/patch-validation.json --shadow results/shadow-patch-execution/shadow-patch-execution.json --approval approval.json --output-root results/pr-creation-intent
```

Outputs:

- `pr-creation-intent.json`
- `pr-creation-intent.md`

## Readiness Rules

The intent is `ready` only when:

- patch proposal status is `patch_proposed`
- patch validation status is `valid`
- shadow patch execution status is `simulated`
- operator approval has `approved: true`
- approval scope is `pr_creation_intent_only`

If validation is `needs_review`, the intent is `needs_review`.

Missing, false, malformed, wrong-scope, or mismatched approval blocks the intent.

## Safety Boundary

- No branch creation.
- No commit creation.
- No push.
- No PR creation.
- No merge.
- No GitHub mutation.
- No patch application.
- No source modification from generated proposals.
- No scheduler/apply/automerge behavior change.

## Future Path

A future guarded PR creation layer may consume this intent, but that layer should
remain explicit, audited, and operator-controlled. This layer is only the
reviewable plan.
