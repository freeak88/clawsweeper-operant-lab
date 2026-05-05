# Policy DSL Dry-Run

The Policy DSL converts approved policy candidates into deterministic JSON rules
that can be evaluated against local ClawSweeper history. In v0.3 this is dry-run
only: no policy action is executed.

## Schema

```json
{
  "policy_id": "auto-resolve-changelog-conflict",
  "status": "approved",
  "conditions": [
    { "field": "conflict_types", "op": "includes", "value": "changelog" },
    { "field": "labels", "op": "not_includes", "value": "security" }
  ],
  "action": {
    "type": "propose_repair",
    "mode": "dry_run_only"
  }
}
```

Policies must have `status: "approved"`. Candidate, rejected, superseded, and
draft proposals are not valid DSL inputs for dry-run evaluation.

Supported condition operators:

- `equals`
- `not_equals`
- `includes`
- `not_includes`
- `exists`
- `not_exists`
- `gte`
- `lte`

Supported action types:

- `propose_close`
- `propose_repair`
- `propose_automerge`
- `annotate_only`

Every action must declare `mode: "dry_run_only"`.

## CLI

```bash
pnpm run policy-dsl -- --policy policy.json --memory results/review-memory/openclaw-openclaw.json
```

The CLI writes:

```text
results/policy-dsl-dry-run/<policy-id>.json
```

The report contains one deterministic evaluation result per memory item:

```json
{
  "policy_id": "auto-resolve-changelog-conflict",
  "dry_run_only": true,
  "evaluated_count": 1,
  "matched_count": 1,
  "results": [
    {
      "policy_id": "auto-resolve-changelog-conflict",
      "matched": true,
      "would_action": "propose_repair",
      "dry_run_only": true,
      "matched_conditions": ["conflict_types includes \"changelog\""],
      "failed_conditions": [],
      "risks": ["dry-run only; no action executed", "would only propose propose_repair"]
    }
  ]
}
```

## Relationship To Promotion

The Policy Promotion Pipeline records proposal lifecycle state. The DSL starts
only after a proposal has been promoted to `approved`. Approval still means
"approved for deterministic dry-run representation," not executable production
behavior.

## Safety Boundary

The evaluator does not mutate GitHub, dispatch repairs, close issues, merge pull
requests, reorder scheduler candidates, alter apply/automerge behavior, or
execute policy actions. Missing fields fail closed for matching conditions.

Future work can add guarded execution behind explicit flags, but v0.3 is only a
local historical evaluation layer.
