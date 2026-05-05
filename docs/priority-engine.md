# Priority Engine

The Priority Engine computes deterministic priority metadata for ClawSweeper issues and pull requests. It is additive scoring infrastructure for future planning work; it does not change item selection, scheduler order, review cadence, apply behavior, close behavior, or automerge behavior by default.

## Purpose

ClawSweeper already separates planning, review, repair, apply, and automerge paths. The Priority Engine gives those systems a shared way to describe why an item appears operationally important without making the scheduler act on that metadata yet.

Each score returns:

- `priority_score`: a number from `0` to `1`
- `priority_band`: `low`, `normal`, `high`, or `critical`
- `priority_reasons`: deterministic text reasons for auditability

## Scoring Model

The first version uses bounded additive signals:

- repository weight
- label weight, including explicit label weights and built-in high-signal labels
- item type, with pull requests slightly higher because they usually need review before merge
- recent activity
- item age
- stale threshold age when available
- author association when available
- risk path signals when available

Missing fields are allowed. They produce stable low-impact reasons instead of throwing.

## Safety Boundary

The Priority Engine is read-only and pure. It does not:

- call GitHub
- mutate GitHub
- dispatch repairs
- close issues
- alter apply or automerge logic
- add work to review shards
- change scheduler ordering

Consumers must opt in explicitly before priority metadata can affect behavior.

## Future Planner Use

A future planner integration can attach priority metadata to durable plans, dashboards, or audit output. Any selection or ordering change should be implemented separately, reviewed with scheduler tests, and guarded so maintainers can compare priority metadata against existing conservative cadence decisions before enabling it.

## Disabled From Selection By Default

Priority scoring is intentionally disabled from scheduler selection by default because changing order changes operational behavior. Keeping this first PR metadata-only lets maintainers inspect scores, tune weights, and validate false positives without increasing review shard load or changing close/apply/automerge outcomes.

## Planning and Status Metadata

Priority metadata can be exposed at the planning/status boundary with:

```sh
CLAWSWEEPER_ENABLE_PRIORITY_METADATA=1 pnpm run plan
```

When enabled, planned candidate objects may include `priority_score`, `priority_band`, and `priority_reasons`. Sweep status JSON also records `priority_metadata_enabled: true` so dashboards can show that the metadata surface was active for a run.

This flag only changes emitted metadata. It does not reorder candidates, change bucket logic, alter shard distribution, mutate GitHub, dispatch repairs, or affect apply/automerge behavior. Review shards still receive the same item numbers selected by the existing planner.

## Priority-Assisted Planner

The normal planner can opt in to using Priority Engine scores for ordering with:

```sh
CLAWSWEEPER_ENABLE_PRIORITY_PLANNER=1 pnpm run plan
```

When enabled, sweep status JSON records `priority_planner_enabled: true`.

This remains conservative. The flag does not change scheduler buckets, bucket weights, batch size, shard count, shard distribution, continuation behavior, apply, automerge, or review shard behavior. It only changes ordering inside an already eligible scheduler bucket and due class.

Ordering limits are exact:

- existing scheduler bucket order remains authoritative
- due candidates stay ahead of floor-backfill or stale-current-review candidates
- priority cannot make a non-due item beat a due item
- inside the same bucket and due class, higher `priority_score` wins
- ties fall back to earlier due time, then older review, then lower item number

The planner flag is separate from `CLAWSWEEPER_ENABLE_PRIORITY_METADATA`. Planner ordering may be enabled without emitting priority metadata in candidate JSON, and metadata may be emitted without allowing priority to affect ordering. Keeping those gates separate lets maintainers inspect scoring and planner effects independently.
