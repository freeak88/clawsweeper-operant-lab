# ClawSweeper Operant Lab Demo Report

> Synthetic example-only artifact. This report uses realistic-looking local data to demonstrate the Operant Lab report surface. No GitHub API calls were made. No GitHub state was mutated. No actions were executed.

## Repository

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Repository   | `openclaw/openclaw`                    |
| Repo slug    | `openclaw-openclaw`                    |
| Generated at | `2026-05-05T12:30:00.000Z`             |
| Dataset      | Synthetic example-only durable records |
| Mode         | Report-only demo generation            |

## Executive Signal

| Signal                       | Result |
| ---------------------------- | -----: |
| Input records                |   `48` |
| Repeated patterns            |    `7` |
| Policy RFC summaries         |    `4` |
| Shadow runtime matches       |   `31` |
| High-confidence observations |   `18` |
| Guarded executions           |    `0` |

**Decision:** do nothing live. The system found useful repeated operational patterns, but v0.7 is report-only and intentionally does not invoke guarded execution.

## Safety Boundary

| Capability                        | Enabled |
| --------------------------------- | ------- |
| GitHub API calls                  | `false` |
| GitHub mutation                   | `false` |
| Guarded execution                 | `false` |
| Repair dispatch                   | `false` |
| Issue close                       | `false` |
| PR merge                          | `false` |
| Scheduler/apply/automerge changes | `false` |

## Input Records

The synthetic dataset models local ClawSweeper durable records from repeated maintenance reviews:

- `20` documentation and changelog records
- `12` low-risk dependency metadata records
- `9` stale-but-actionable issue records
- `7` workflow-adjacent records that require higher caution

No live repository scan was performed. The report assumes records already exist locally under `records/openclaw-openclaw/`.

## Detected Patterns

| Pattern type        | Pattern value                | Occurrences | Distinct items | Interpretation                                                     |
| ------------------- | ---------------------------- | ----------: | -------------: | ------------------------------------------------------------------ |
| `label`             | `docs`                       |        `18` |           `18` | Documentation-only maintenance is recurring.                       |
| `label`             | `maintenance`                |        `22` |           `20` | Low-risk routine upkeep appears often.                             |
| `review_verdict`    | `annotate_only`              |        `14` |           `14` | Many items need explanation rather than mutation.                  |
| `repair_marker`     | `successful-repair`          |        `11` |            `9` | Prior repair runs succeeded on similar surfaces.                   |
| `conflict_type`     | `changelog`                  |         `8` |            `8` | Changelog conflicts repeat and are easy to classify.               |
| `safe_close_reason` | `implemented_on_main`        |         `6` |            `6` | Some reports are already resolved upstream.                        |
| `automerge_cause`   | `validation-green-docs-only` |         `5` |            `5` | A narrow docs-only automerge pattern is visible, but not executed. |

## Policy RFC Summaries

| RFC                                               | Status    | Confidence | Summary                                                                       | Proposed action               |
| ------------------------------------------------- | --------- | ---------: | ----------------------------------------------------------------------------- | ----------------------------- |
| `policy-rfc-label-docs-8a0bf3cc`                  | Draft     |     `0.72` | Treat repeated docs-only maintenance as an annotation-first policy candidate. | `annotate_only`               |
| `policy-rfc-conflict-changelog-41df0a21`          | Draft     |     `0.68` | Standardize changelog conflict triage into a repeatable RFC pattern.          | `propose_repair` dry-run only |
| `policy-rfc-verdict-annotate-only-9426d3b9`       | Candidate |     `0.81` | Preserve low-risk review knowledge as a human-readable annotation.            | `annotate_only`               |
| `policy-rfc-safe-close-implemented-main-2dd091fb` | Draft     |     `0.63` | Capture implemented-on-main evidence for later human review.                  | `propose_close` dry-run only  |

All RFCs remain proposal artifacts. None of them execute policies or mutate GitHub.

## Confidence Outputs

| Target                |  Score | Band     | Suggested action                | Blocking risks         |
| --------------------- | -----: | -------- | ------------------------------- | ---------------------- |
| `review_verdict`      | `0.86` | `high`   | `eligible_for_policy_candidate` | none                   |
| `repair_acceptance`   | `0.74` | `medium` | `require_human_review`          | broad file surface     |
| `safe_close`          | `0.66` | `medium` | `require_human_review`          | snapshot drift unknown |
| `automerge_readiness` | `0.38` | `low`    | `observe`                       | workflow-adjacent path |

The confidence layer is deliberately asymmetric: strong evidence can recommend a policy candidate, but uncertain drift, workflow paths, or automerge-sensitive surfaces keep action disabled.

## Shadow Runtime

Approved dry-run DSL rules were evaluated against the synthetic Review Memory index.

| Policy                       | Would action        | Matches | Dry-run only | Notes                                              |
| ---------------------------- | ------------------- | ------: | ------------ | -------------------------------------------------- |
| `safe-annotation-policy`     | `annotate_only`     |    `14` | `true`       | Matched low-risk maintenance/docs items.           |
| `changelog-conflict-triage`  | `propose_repair`    |     `8` | `true`       | Useful signal, but repair dispatch remains off.    |
| `implemented-on-main-review` | `propose_close`     |     `6` | `true`       | Requires human review before any future promotion. |
| `docs-validation-green`      | `propose_automerge` |     `3` | `true`       | Observed only; automerge remains unchanged.        |

Shadow total:

```json
{
  "policy_count": 4,
  "item_count": 48,
  "match_count": 31,
  "would_action_counts": {
    "annotate_only": 14,
    "propose_repair": 8,
    "propose_close": 6,
    "propose_automerge": 3
  }
}
```

## Shadow Metrics

| Metric                                          |  Value |
| ----------------------------------------------- | -----: |
| Policies analyzed                               |    `4` |
| Total shadow matches                            |   `31` |
| Average confidence                              | `0.71` |
| Blocked matches                                 |    `2` |
| Risk-bearing matches                            |    `9` |
| Candidate policies for future guarded execution |    `1` |

Candidate result:

| Policy                       | Candidate | Reason                                                               |
| ---------------------------- | --------- | -------------------------------------------------------------------- |
| `safe-annotation-policy`     | `true`    | Meets conservative shadow criteria for annotation-only behavior.     |
| `changelog-conflict-triage`  | `false`   | Action is repair-related; v0.7 does not execute or dispatch repairs. |
| `implemented-on-main-review` | `false`   | Close proposals require stricter human review.                       |
| `docs-validation-green`      | `false`   | Automerge remains outside the allowed execution surface.             |

## Adaptive Scheduler Recommendations

The Adaptive Scheduler layer is recommendation-only. These values are synthetic demo recommendations derived from planning/status-like inputs.

| Input               | Value |
| ------------------- | ----: |
| Planned count       |  `64` |
| Planned capacity    |  `48` |
| Due backlog         |  `37` |
| Active Codex target |  `32` |
| Failed shard count  |   `0` |
| Current shard count |  `40` |
| Current batch size  |   `1` |

Recommendation:

```json
{
  "recommended_shard_count": 48,
  "recommended_min_active_shards": 24,
  "recommended_batch_size": 1,
  "recommendation": "increase_capacity",
  "confidence": 0.74,
  "reasons": [
    "synthetic due backlog exceeds current planned capacity",
    "no failed shard signal present",
    "batch size remains conservative at 1"
  ]
}
```

This does not change scheduler settings. It is an operator-facing recommendation only.

## Proposed Policies

The demo surfaces one safe-looking candidate for future manual review:

```json
{
  "policy_id": "safe-annotation-policy",
  "status": "approved",
  "conditions": [
    { "field": "labels", "op": "includes", "value": "maintenance" },
    { "field": "labels", "op": "includes", "value": "docs" },
    { "field": "verdicts", "op": "includes", "value": "annotate_only" },
    { "field": "conflict_types", "op": "not_includes", "value": "security" }
  ],
  "action": {
    "type": "annotate_only",
    "mode": "dry_run_only"
  }
}
```

Even this safe-looking policy is not executed by the Demo Report Generator.

## Decision

```json
{
  "executed": false,
  "reason": "synthetic report-only demo generation"
}
```

The best decision for this report is intentionally conservative: preserve the evidence, show the reasoning, and take no live action.

## What The System Would Have Done

If this were a future manually reviewed operator workflow, the system would have suggested:

- annotate recurring maintenance/docs items with a consistent explanation
- keep changelog conflict handling in dry-run repair proposal mode
- require human review for safe-close and automerge-adjacent patterns
- increase scheduler capacity only as a recommendation, not as a runtime change

## What Actually Happened

- No GitHub API calls were made.
- No GitHub state was mutated.
- No issue was closed.
- No PR was merged.
- No repair was dispatched.
- No guarded execution was called.
- No scheduler/apply/automerge behavior changed.

## Safe Next Step

Review the synthetic report shape with maintainers. If the surface is useful, run the same Demo Report Generator against real local durable records and compare the shadow recommendations with human judgment before considering any future operator dashboard or Shadow Decision Runtime.
