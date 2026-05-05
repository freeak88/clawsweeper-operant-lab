# Shadow Runtime Reports

Shadow Runtime Reports run approved Policy DSL rules against local review-memory
records and summarize what actions would have been proposed. The reports are
observational only.

## Purpose

The shadow runtime is the bridge between deterministic policy rules and future
guarded execution. It answers: "If these approved rules were evaluated against
historical ClawSweeper memory, what would they have proposed?"

It does not execute policy actions.

## CLI

```bash
pnpm run shadow-runtime -- --policies results/policies --memory results/review-memory/openclaw-openclaw.json
```

Inputs:

- `--policies`: directory containing Policy DSL JSON files.
- `--memory`: a Review Memory JSON index.

Only policies with `status: "approved"` and `mode: "dry_run_only"` are
evaluated. Draft, candidate, rejected, superseded, malformed, or executable
policy files are skipped with warnings.

## Output

Reports are written to:

```text
results/shadow-runtime/<target-repo>/<timestamp>.json
```

`<target-repo>` uses the repository slug, such as `openclaw-openclaw`.

Report shape:

```json
{
  "schema_version": 1,
  "generated_at": "2026-05-05T00:00:00.000Z",
  "target_repo": "openclaw/openclaw",
  "summary": {
    "policy_count": 1,
    "item_count": 2,
    "match_count": 1,
    "would_action_counts": {
      "propose_repair": 1
    }
  },
  "matches": [
    {
      "policy_id": "auto-resolve-changelog-conflict",
      "item_number": 1,
      "matched": true,
      "would_action": "propose_repair",
      "dry_run_only": true,
      "confidence_score": 0.49,
      "confidence_band": "medium",
      "risks": ["dry-run only; no action executed", "would only propose propose_repair"]
    }
  ]
}
```

## Dry-Run Boundary

The shadow runtime does not mutate GitHub, close issues, merge pull requests,
dispatch repairs, reorder scheduler candidates, change apply/automerge behavior,
or execute DSL actions. Missing item fields fail closed through the Policy DSL
evaluator.

## Future Path

Future releases may compare shadow results to actual maintainer outcomes, tune
confidence gates, or promote a subset of rules toward guarded execution. Any
execution path must be a separate, explicitly flagged change.
