# Policy Promotion Pipeline

The Policy Promotion Pipeline gives Policy RFC proposals a conservative local
lifecycle:

```text
draft -> candidate -> approved
                 \-> rejected
approved -> superseded
```

It is state management only. Promotion records do not execute policies, mutate
GitHub, change scheduler selection, dispatch repairs, close issues, merge pull
requests, or alter apply/automerge behavior.

## Purpose

Policy RFC generation turns repeated ClawSweeper review and repair patterns into
draft proposals. Promotion records let an operator move those proposals through a
reviewable lifecycle without losing history.

The statuses are:

- `draft`: generated or manually authored proposal, not yet accepted for policy
  review.
- `candidate`: accepted for deeper policy review.
- `approved`: approved as a future policy source, but still not executable by
  this pipeline.
- `rejected`: rejected; it cannot become approved directly.
- `superseded`: approved proposal replaced by a later proposal.

## CLI

```bash
pnpm run policy-promote -- --proposal results/policy-rfc/openclaw-openclaw/example.json --to candidate --reason "repeated stable pattern"
```

Optional local evidence can be attached to the immutable event:

```bash
pnpm run policy-promote -- \
  --proposal results/policy-rfc/openclaw-openclaw/example.json \
  --to candidate \
  --reason "high confidence repeated repair" \
  --confidence-metadata results/confidence/example.json \
  --review-memory-evidence results/review-memory/openclaw-openclaw.json
```

## Output

Promotion state is written to:

```text
results/policy-promotions/<proposal-id>.json
```

The record shape is:

```json
{
  "proposal_id": "repair-marker-validation-fix",
  "current_status": "candidate",
  "events": [
    {
      "from_status": "draft",
      "to_status": "candidate",
      "reason": "repeated stable pattern",
      "created_at": "2026-05-05T00:00:00.000Z"
    }
  ],
  "latest_reason": "repeated stable pattern",
  "updated_at": "2026-05-05T00:00:00.000Z"
}
```

Event history is append-only. Existing promotion records are read before each
transition, and the next transition preserves prior events.

## Safety Boundary

Approved means "approved as documentation/state for future work." It does not
mean executable. A later explicit system would need to convert approved policies
into deterministic rules and wire those rules behind strict runtime flags.
