# Operator Approval Gate

The Operator Approval Gate is a conservative planning layer for the Autonomous Improvement Loop. It converts an explicitly approved improvement proposal into a local implementation plan artifact.

It does not implement the plan. It does not create pull requests. It does not mutate GitHub.

## Approval Model

The gate requires an explicit operator approval record:

```json
{
  "proposal_id": "improve-scheduler-saturated_backlog-1234abcd",
  "approved": true,
  "approved_by": "operator",
  "approved_at": "2026-05-05T12:00:00.000Z",
  "approval_scope": "implementation_plan_only",
  "notes": "Approved for planning only."
}
```

The only accepted scope is:

```text
implementation_plan_only
```

Any missing approval, false approval, mismatched proposal id, invalid proposal, or wrong scope fails closed and writes a blocked output.

## CLI Usage

```bash
pnpm run approval-gate -- \
  --proposal results/improvement-loop/openclaw-openclaw/proposal.json \
  --approval approvals/improve-scheduler.json \
  --output-root results/approval-gate
```

Optional context:

```bash
pnpm run approval-gate -- \
  --proposal proposal.json \
  --approval approval.json \
  --simulation simulation.json \
  --suggestion guarded-pr-suggestion.json \
  --output-root results/approval-gate
```

## Output

Approved output:

```json
{
  "plan_id": "plan-improve-scheduler-saturated_backlog-1234abcd",
  "proposal_id": "improve-scheduler-saturated_backlog-1234abcd",
  "status": "approved_for_planning",
  "implementation_steps": [],
  "files_likely_changed": [],
  "tests_required": [],
  "rollback_plan": [],
  "safety_constraints": []
}
```

Blocked output:

```json
{
  "plan_id": "plan-improve-scheduler-saturated_backlog-1234abcd",
  "proposal_id": "improve-scheduler-saturated_backlog-1234abcd",
  "status": "blocked",
  "blocked_reason": "operator approval is false",
  "safety_constraints": []
}
```

## Safety Boundary

Approval authorizes planning only.

The gate does not:

- create PRs automatically
- mutate GitHub
- merge PRs
- change scheduler/apply/automerge behavior
- dispatch repairs
- execute code changes

## Future Path

Future supervised implementation could consume approved plans as human-reviewed task briefs. That future step should remain separate, explicit, and auditable.
