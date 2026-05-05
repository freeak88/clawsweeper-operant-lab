# Guarded Execution

Guarded Execution is the first minimal opt-in execution boundary for Operant Lab policies. v0.6 is deliberately tiny: it can only allow local annotation-style actions after a policy has passed shadow metrics and high-confidence checks.

Default behavior is off.

```bash
CLAWSWEEPER_ENABLE_GUARDED_EXECUTION=1 pnpm run guarded-execution -- \
  --policy results/policy-dsl-dry-run/safe-annotation-policy.json \
  --metrics results/shadow-metrics/latest.json \
  --confidence results/confidence/safe-annotation-policy-42.json \
  --item-number 42 \
  --dry-run true
```

## Safety Model

The engine allows only:

- `annotate_only`
- `suggest_comment`

The engine explicitly does not allow:

- closing issues
- merging PRs
- dispatching repairs
- modifying repository state
- mutating GitHub
- changing scheduler, apply, or automerge behavior

All decisions are written to `results/guarded-execution/` with full reasoning and a rollback hint. `dry_run=true` prevents execution even when every other check passes.

## Required Gates

A guarded action can be allowed only when all gates pass:

- `CLAWSWEEPER_ENABLE_GUARDED_EXECUTION=1`
- `dry_run=false`
- policy status is `approved`
- shadow metrics mark `candidate_for_guarded_execution: true`
- confidence score is at least `0.9`
- blocked count is `0`
- risk count is `0`
- action is `annotate_only` or `suggest_comment`

Any failed gate results in `executed: false`.

## Why Only Annotation

Annotation-style output is reversible because v0.6 only writes local decision logs. It does not call GitHub APIs, update issue state, merge pull requests, dispatch repair jobs, or alter repository contents.

## Future Roadmap

Future guarded execution work may add manual promotion gates, operator approvals, or carefully scoped GitHub comment publication. Those paths must remain separately flagged, auditable, reversible, and covered by shadow evidence before they can affect live systems.
