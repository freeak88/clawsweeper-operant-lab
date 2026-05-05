# Adaptive Scheduler Recommendations

The Adaptive Scheduler layer emits recommendation-only capacity metadata from existing ClawSweeper planning and status metrics. It does not change scheduler behavior in this PR.

## Purpose

ClawSweeper already records planning signals such as planned count, capacity, active Codex target, due backlog, and capacity reason. The recommendation layer turns those signals into a deterministic advisory object that maintainers can review before any future adaptive execution exists.

## Inputs

The recommender can use:

- `target_repo`
- `lane`
- `planned_count`
- `planned_capacity`
- `active_codex_target`
- `due_backlog`
- `oldest_unreviewed_at`
- `capacity_reason`
- `failed_shard_count`
- `review_duration_ms`
- `current_shard_count`
- `current_min_active_shards`
- `current_batch_size`

## Output

```json
{
  "adaptive_scheduler_recommendation": {
    "recommended_shard_count": 60,
    "recommended_min_active_shards": 30,
    "recommended_batch_size": 1,
    "recommendation": "increase_capacity",
    "confidence": 0.82,
    "reasons": [
      "due backlog 80 >= planned capacity 50",
      "saturated capacity reason: saturated: due backlog filled planned capacity"
    ]
  }
}
```

## Metadata Flag

Planning/status metadata can be exposed with:

```sh
CLAWSWEEPER_ENABLE_ADAPTIVE_SCHEDULER_METADATA=1 pnpm run plan
```

When enabled, plan JSON and status JSON may include `adaptive_scheduler_recommendation`. Status JSON also records `adaptive_scheduler_metadata_enabled: true`.

## Safety Boundary

This PR does not:

- mutate `.github/workflows/sweep.yml`
- change shard count
- change batch size
- change cadence
- change continuation
- change scheduler selection or ordering
- change apply or automerge behavior
- mutate GitHub
- add work to review shards

The recommendation is advisory data only.

## Future Path

A future PR may add an explicit opt-in execution mode that consumes these recommendations. That should be separate from this metadata layer and should include scheduler, workflow, and safety tests proving that capacity changes are bounded and reversible.
