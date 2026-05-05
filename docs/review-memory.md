# Review Memory Layer

The Review Memory Layer builds a deterministic local JSON index from ClawSweeper durable records, repair markers, generated Policy RFC proposals, and recorded outcomes. It is generated-state infrastructure for audit and future planning work.

It is read-only with respect to GitHub and does not affect scheduler selection, priority planner ordering, review shards, apply behavior, close behavior, or automerge behavior by default.

## Purpose

ClawSweeper already writes durable markdown and JSON records as it reviews, repairs, and applies conservative outcomes. Review Memory summarizes repeated operational signals from those records so future systems can ask questions like:

- which labels recur across reviewed items
- which verdicts or safe-close reasons show up repeatedly
- which repair markers, conflict types, and automerge causes are common
- which Policy RFC proposals are related to prior records
- what historical signals are known for a specific item

The first version only indexes local state. It does not execute decisions from that memory.

## CLI Usage

```sh
pnpm run review-memory -- --target-repo openclaw/openclaw
```

By default this reads:

- `records/<repo-slug>/...`
- `results/policy-rfc/<repo-slug>/...`

and writes:

- `results/review-memory/<repo-slug>.json`

The CLI also accepts `--records-root`, `--policy-rfc-root`, `--output-root`, and `--generated-at` for tests or local experiments.

## Generated Output

The output is deterministic for the same input records except for `generated_at` unless that timestamp is provided explicitly.

```json
{
  "schema_version": 1,
  "generated_at": "2026-01-01T00:00:00.000Z",
  "target_repo": "openclaw/openclaw",
  "summary": {
    "record_count": 2,
    "item_count": 1,
    "pattern_count": 3
  },
  "patterns": [],
  "items": []
}
```

Patterns include `label`, `verdict`, `repair_marker`, `conflict_type`, `safe_close_reason`, `automerge_cause`, and `policy_rfc`. Item memory includes per-item arrays for the same signal families.

## Safety Boundary

Review Memory does not:

- call GitHub
- mutate GitHub
- dispatch repairs
- close issues or pull requests
- alter apply or automerge logic
- change scheduler ordering
- change priority planner ordering
- add work to review shards

It only reads local durable records and writes generated JSON under `results/review-memory/`.

## Future Consumers

Future planner, repair, dashboard, or RFC systems may consume this index to explain repeated patterns or prefill proposal evidence. Any behavior change that uses memory for selection, routing, or mutation should be implemented separately behind its own explicit flag and covered by scheduler/apply tests.
