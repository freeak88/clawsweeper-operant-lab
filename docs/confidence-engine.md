# Confidence Engine

The Confidence Engine computes proposal-only confidence metadata for ClawSweeper actions such as safe-close proposals, repair acceptance, automerge readiness, and review verdicts.

It does not execute actions. It does not close issues, merge pull requests, dispatch repairs, mutate GitHub, or change scheduler behavior.

## Targets

The supported confidence targets are:

- `safe_close`
- `repair_acceptance`
- `automerge_readiness`
- `review_verdict`

## Signals

The scorer can use local review-like signals:

- review verdict
- safe-close reason
- snapshot drift status
- labels
- author association
- required check status
- CI/check failures
- repair markers
- conflict types
- priority band
- model routing tier
- review memory patterns
- Policy RFC matches
- touched file paths

Missing fields are allowed and default conservatively.

## Output

```json
{
  "confidence_target": "safe_close",
  "confidence_score": 0.83,
  "confidence_band": "high",
  "suggested_action": "eligible_for_policy_candidate",
  "confidence_reasons": [
    "high-confidence review verdict close",
    "safe-close reason implemented_on_main"
  ],
  "blocking_risks": []
}
```

## Metadata Flag

Planning/status metadata can be exposed with:

```sh
CLAWSWEEPER_ENABLE_CONFIDENCE_METADATA=1 pnpm run plan
```

When enabled, planning candidate JSON may include confidence metadata where lightweight local signals are available. Status JSON records `confidence_metadata_enabled: true`.

## Safety Boundary

This layer does not:

- change apply behavior
- change automerge behavior
- close issues
- merge pull requests
- dispatch repairs
- mutate GitHub
- change scheduler selection
- change shard count, batch size, cadence, or continuation
- add work to review shards

The output is advisory metadata only.

## Future Path

Future PRs may use confidence metadata to support manual promotion, policy-candidate workflows, or review dashboards. Any execution behavior should be introduced separately behind explicit opt-in flags with apply/automerge safety tests.
