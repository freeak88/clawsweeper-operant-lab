# Demo Case: Annotation-Only Maintenance Pattern

This demo case shows an end-to-end Operant Lab run using a small local sample dataset shaped like ClawSweeper durable review records.

All generated files are committed under [`docs/demo-output/`](demo-output/), so the case can be inspected without GitHub credentials or live scheduler state.

## Input Data

Input records:

- [`docs/demo-output/input/records/openclaw-openclaw/items/101.md`](demo-output/input/records/openclaw-openclaw/items/101.md)
- [`docs/demo-output/input/records/openclaw-openclaw/items/102.md`](demo-output/input/records/openclaw-openclaw/items/102.md)
- [`docs/demo-output/input/records/openclaw-openclaw/items/103.md`](demo-output/input/records/openclaw-openclaw/items/103.md)
- [`docs/demo-output/input/records/openclaw-openclaw/items/104.md`](demo-output/input/records/openclaw-openclaw/items/104.md)
- [`docs/demo-output/input/records/openclaw-openclaw/items/105.md`](demo-output/input/records/openclaw-openclaw/items/105.md)

Each record describes a low-risk maintenance/docs item with:

- labels: `maintenance`, `docs`
- verdict: `annotate_only`
- repair marker: `successful-repair`
- conflict type: `documentation`
- safe-close reason: `not_applicable_annotation_only`

The demo also includes an approved dry-run Policy DSL rule:

- [`docs/demo-output/input/policies/safe-annotation-policy.json`](demo-output/input/policies/safe-annotation-policy.json)

and confidence metadata for the final guarded-execution dry-run:

- [`docs/demo-output/input/confidence-high.json`](demo-output/input/confidence-high.json)

## Commands Run

```bash
pnpm run build

pnpm run review-memory -- \
  --target-repo openclaw/openclaw \
  --records-root docs/demo-output/input/records \
  --policy-rfc-root docs/demo-output/results/policy-rfc \
  --output-root docs/demo-output/results/review-memory \
  --generated-at 2026-05-05T12:00:00.000Z

pnpm run policy-rfc -- \
  --target-repo openclaw/openclaw \
  --records-root docs/demo-output/input/records \
  --output-root docs/demo-output/results/policy-rfc \
  --min-occurrences 5 \
  --created-at 2026-05-05T12:00:00.000Z

pnpm run policy-promote -- \
  --proposal docs/demo-output/results/policy-rfc/openclaw-openclaw/policy-rfc-review-verdict-annotate-only-9426d3b9.json \
  --to candidate \
  --reason "demo pattern repeated across five annotation-only records" \
  --output-root docs/demo-output/results/policy-promotions \
  --now 2026-05-05T12:05:00.000Z

pnpm run policy-dsl -- \
  --policy docs/demo-output/input/policies/safe-annotation-policy.json \
  --memory docs/demo-output/results/review-memory/openclaw-openclaw.json \
  --output-root docs/demo-output/results/policy-dsl-dry-run

pnpm run shadow-runtime -- \
  --policies docs/demo-output/input/policies \
  --memory docs/demo-output/results/review-memory/openclaw-openclaw.json \
  --output-root docs/demo-output/results/shadow-runtime \
  --generated-at 2026-05-05T12:10:00.000Z

pnpm run shadow-metrics -- \
  --reports docs/demo-output/results/shadow-runtime/openclaw-openclaw \
  --output-root docs/demo-output/results/shadow-metrics \
  --generated-at 2026-05-05T12:15:00.000Z

CLAWSWEEPER_ENABLE_GUARDED_EXECUTION=1 pnpm run guarded-execution -- \
  --policy docs/demo-output/input/policies/safe-annotation-policy.json \
  --metrics docs/demo-output/results/shadow-metrics/2026-05-05T12-15-00-000Z.json \
  --confidence docs/demo-output/input/confidence-high.json \
  --item-number 101 \
  --dry-run true \
  --output-root docs/demo-output/results/guarded-execution \
  --generated-at 2026-05-05T12:20:00.000Z
```

## Review Memory

Output:

- [`docs/demo-output/results/review-memory/openclaw-openclaw.json`](demo-output/results/review-memory/openclaw-openclaw.json)

Summary:

- records indexed: `5`
- items indexed: `5`
- patterns detected: `6`

Detected patterns:

- `conflict_type=documentation`
- `label=docs`
- `label=maintenance`
- `repair_marker=successful-repair`
- `safe_close_reason=not_applicable_annotation_only`
- `verdict=annotate_only`

## Generated Policy RFCs

Output directory:

- [`docs/demo-output/results/policy-rfc/openclaw-openclaw/`](demo-output/results/policy-rfc/openclaw-openclaw/)

The RFC engine generated six RFC proposals, one for each repeated pattern. The demo promotion uses:

- [`policy-rfc-review-verdict-annotate-only-9426d3b9.json`](demo-output/results/policy-rfc/openclaw-openclaw/policy-rfc-review-verdict-annotate-only-9426d3b9.json)
- [`policy-rfc-review-verdict-annotate-only-9426d3b9.md`](demo-output/results/policy-rfc/openclaw-openclaw/policy-rfc-review-verdict-annotate-only-9426d3b9.md)

## Promotion

Output:

- [`docs/demo-output/results/policy-promotions/policy-rfc-review-verdict-annotate-only-9426d3b9.json`](demo-output/results/policy-promotions/policy-rfc-review-verdict-annotate-only-9426d3b9.json)

The selected RFC was promoted:

```text
draft -> candidate
```

Reason:

```text
demo pattern repeated across five annotation-only records
```

## DSL Rule

The demo uses a deterministic approved DSL rule derived from the candidate RFC:

- [`docs/demo-output/input/policies/safe-annotation-policy.json`](demo-output/input/policies/safe-annotation-policy.json)

Rule conditions:

- `labels includes "maintenance"`
- `verdicts includes "annotate_only"`
- `repair_markers includes "successful-repair"`
- `conflict_types not_includes "security"`

Action:

```text
annotate_only
```

The Policy DSL dry-run output is:

- [`docs/demo-output/results/policy-dsl-dry-run/safe-annotation-policy.json`](demo-output/results/policy-dsl-dry-run/safe-annotation-policy.json)

Result:

- evaluated items: `5`
- matched items: `5`
- execution: none, dry-run only

## Shadow Runtime

Output:

- [`docs/demo-output/results/shadow-runtime/openclaw-openclaw/2026-05-05T12-10-00-000Z.json`](demo-output/results/shadow-runtime/openclaw-openclaw/2026-05-05T12-10-00-000Z.json)

Result:

- policies evaluated: `1`
- items evaluated: `5`
- matches: `5`
- would action: `annotate_only`
- execution: none, reporting-only

## Shadow Metrics

Output:

- [`docs/demo-output/results/shadow-metrics/2026-05-05T12-15-00-000Z.json`](demo-output/results/shadow-metrics/2026-05-05T12-15-00-000Z.json)

Result:

- policy count: `1`
- total matches: `5`
- matches for `safe-annotation-policy`: `5`
- would-action count: `annotate_only=5`
- blocked count: `0`
- risk count: `5`
- average confidence: `0.48`
- candidate for guarded execution: `false`

Candidate reason:

```text
average confidence below threshold: 0.48/0.8
```

This is intentionally conservative. The shadow evidence shows repeated matches, but the metrics layer does not yet consider the policy safe enough for guarded execution under default thresholds.

## Final Guarded Decision

Output:

- [`docs/demo-output/results/guarded-execution/2026-05-05T12-20-00-000Z-safe-annotation-policy-101.json`](demo-output/results/guarded-execution/2026-05-05T12-20-00-000Z-safe-annotation-policy-101.json)

The command was run with:

```text
CLAWSWEEPER_ENABLE_GUARDED_EXECUTION=1
dry_run=true
```

Decision:

```json
{
  "executed": false,
  "action": "none",
  "reason": "dry_run=true prevents execution"
}
```

No rollback was required because nothing was executed.

## What The System Would Have Done Vs What Actually Happened

What the system would have proposed:

- The approved DSL rule would have proposed `annotate_only` for all five matching maintenance/docs records.
- Shadow Runtime recorded those five proposed annotations as dry-run matches.

What actually happened:

- No GitHub state was mutated.
- No issue was closed.
- No PR was merged.
- No repair was dispatched.
- No repository state was modified.
- Guarded Execution wrote a local decision log only, and because `dry_run=true`, it returned `executed=false`.

The demo shows the intended conservative posture: repeated evidence is collected, formalized, evaluated, measured, and logged, but live behavior remains off unless future gates explicitly allow it.
