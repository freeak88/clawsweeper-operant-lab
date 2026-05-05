# ClawSweeper Operant Lab Architecture

Operant Lab is a conservative learning layer around ClawSweeper's durable records. It converts repeated operational history into policy proposals, dry-run rules, shadow evidence, and minimal guarded decisions.

The pipeline is intentionally staged:

```text
records -> memory -> RFC -> promotion -> DSL -> shadow runtime -> metrics -> guarded execution
```

Each stage produces local documentation or generated state. Later stages consume earlier outputs, but none of the Operant Lab stages change ClawSweeper scheduler, apply, automerge, or repair behavior by default.

## 1. Records

ClawSweeper already writes durable records for reviews, repairs, outcomes, status, and generated state. These records are the historical evidence source.

Examples:

```text
records/<repo-slug>/items/<number>.md
records/<repo-slug>/closed/<number>.md
results/sweep-status/
results/policy-rfc/
```

Boundary: records are read as local evidence. Missing, old, or malformed records should not crash the lab pipeline.

## 2. Review Memory

Review Memory builds a deterministic local JSON index from durable records and generated proposals.

It summarizes:

- recurring labels
- recurring review verdicts
- recurring repair markers
- recurring conflict types
- recurring safe-close reasons
- recurring automerge causes
- Policy RFC references
- per-item historical signals

Output:

```text
results/review-memory/<repo-slug>.json
```

Boundary: read-only indexing.

## 3. Policy RFC

The Policy RFC Engine identifies repeated patterns and emits reviewable RFC-style proposals.

Outputs:

- human-readable Markdown RFC
- machine-readable JSON proposal

Boundary: proposal-only. RFCs do not execute rules.

## 4. Promotion

The Promotion Pipeline records explicit operator decisions:

```text
draft -> candidate -> approved -> rejected -> superseded
```

Every transition writes immutable event history.

Output:

```text
results/policy-promotions/<proposal-id>.json
```

Boundary: lifecycle/state management only.

## 5. Policy DSL

The Policy DSL represents approved policy candidates as deterministic JSON rules.

Supported v0.3 operators:

- `equals`
- `not_equals`
- `includes`
- `not_includes`
- `exists`
- `not_exists`
- `gte`
- `lte`

Policy DSL actions remain dry-run. Unsupported executable actions are rejected.

Boundary: dry-run evaluation only.

## 6. Shadow Runtime

Shadow Runtime runs approved Policy DSL rules against Review Memory records and reports what would have been proposed.

Output:

```text
results/shadow-runtime/<target-repo>/<timestamp>.json
```

Boundary: reporting-only. No DSL action is executed.

## 7. Shadow Metrics

Shadow Metrics aggregates Shadow Runtime reports into policy-level evidence.

It computes:

- total matches
- matches by policy
- would-action counts
- average confidence by policy
- blocked counts
- risk counts
- high/low confidence match counts
- conservative guarded-execution candidate flags

Output:

```text
results/shadow-metrics/<timestamp>.json
```

Boundary: advisory analysis only.

## 8. Guarded Execution

Guarded Execution is the first minimal opt-in decision layer.

It is:

- default OFF
- flag-gated by `CLAWSWEEPER_ENABLE_GUARDED_EXECUTION=1`
- dry-run capable
- fully logged
- limited to `annotate_only` and `suggest_comment`

Required gates:

- policy is approved
- shadow metrics mark it as a guarded-execution candidate
- confidence score is at least `0.9`
- blocked count is `0`
- risk count is `0`
- action is allowed
- dry-run is explicitly disabled

Output:

```text
results/guarded-execution/<timestamp>-<policy-id>-<item-number>.json
```

Boundary: local decision logging. v0.6 does not publish comments, mutate GitHub, close issues, merge PRs, dispatch repairs, modify repository state, or change scheduler/apply/automerge behavior.

## Safety Invariants

Across the entire Operant Lab stack:

- Default OFF.
- Proposal-first.
- Dry-run first.
- No GitHub mutation by default.
- No issue closing.
- No PR merging.
- No repair dispatch.
- No scheduler/apply/automerge behavior changes by default.
- Guarded execution only supports `annotate_only` and `suggest_comment`.

The architecture is deliberately incremental. Each layer must earn trust through durable evidence before any future broader execution path is considered.
