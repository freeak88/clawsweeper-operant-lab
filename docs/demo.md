# ClawSweeper Operant Lab Demo

This guide shows the intended end-to-end shape of the Operant Lab stack. The commands are local-first and assume you already have durable records, review-memory data, or fixtures available in the repository.

All paths are examples. Replace them with the records, proposals, policies, and reports produced in your run.

## 1. Build Review Memory

Review Memory indexes durable ClawSweeper records into a local JSON summary.

```bash
pnpm run build
pnpm run review-memory -- --target-repo openclaw/openclaw
```

Expected output:

```text
results/review-memory/openclaw-openclaw.json
```

Safety: read-only generated state. It does not change scheduling, apply, automerge, repair, or GitHub state.

## 2. Generate Policy RFCs

Policy RFC generation scans local records for repeated operational patterns and writes proposal documents.

```bash
pnpm run policy-rfc -- --target-repo openclaw/openclaw
```

Expected output:

```text
results/policy-rfc/openclaw-openclaw/
```

Safety: proposal-only. No policies are executed.

## 3. Promote RFC To Candidate And Approved

Promotion records explicit operator lifecycle decisions.

```bash
pnpm run policy-promote -- \
  --proposal results/policy-rfc/openclaw-openclaw/<proposal>.json \
  --to candidate \
  --reason "repeated stable pattern"

pnpm run policy-promote -- \
  --proposal results/policy-rfc/openclaw-openclaw/<proposal>.json \
  --to approved \
  --reason "operator approved for dry-run evaluation"
```

Expected output:

```text
results/policy-promotions/<proposal-id>.json
```

Safety: lifecycle/state management only.

## 4. Convert Or Use Policy DSL

Approved policies can be represented as deterministic Policy DSL JSON.

Example policy:

```json
{
  "policy_id": "safe-annotation-policy",
  "status": "approved",
  "conditions": [
    { "field": "labels", "op": "includes", "value": "maintenance" },
    { "field": "conflict_types", "op": "not_includes", "value": "security" }
  ],
  "action": {
    "type": "annotate_only",
    "mode": "dry_run_only"
  }
}
```

Run the DSL evaluator:

```bash
pnpm run policy-dsl -- \
  --policy policies/safe-annotation-policy.json \
  --memory results/review-memory/openclaw-openclaw.json
```

Safety: dry-run only. Unsupported executable actions are rejected.

## 5. Run Shadow Runtime

Shadow Runtime evaluates approved Policy DSL rules against Review Memory and reports what would have been proposed.

```bash
pnpm run shadow-runtime -- \
  --policies policies \
  --memory results/review-memory/openclaw-openclaw.json
```

Expected output:

```text
results/shadow-runtime/openclaw-openclaw/<timestamp>.json
```

Safety: reporting-only. DSL actions are not executed.

## 6. Analyze Shadow Metrics

Shadow Metrics aggregates Shadow Runtime reports and marks conservative future guarded-execution candidates.

```bash
pnpm run shadow-metrics -- --reports results/shadow-runtime/openclaw-openclaw
```

Expected output:

```text
results/shadow-metrics/<timestamp>.json
```

Candidate criteria are intentionally strict:

- enough observations
- high average confidence
- zero blocked matches
- low or zero risk count
- action type allowlisted for future guarded execution

Safety: metrics are advisory only.

## 7. Run Guarded Execution In Dry-Run

Guarded Execution is off by default and supports `dry_run=true`.

```bash
pnpm run guarded-execution -- \
  --policy policies/safe-annotation-policy.json \
  --metrics results/shadow-metrics/<timestamp>.json \
  --confidence fixtures/confidence-high.json \
  --item-number 42 \
  --dry-run true
```

Expected result:

```json
{
  "executed": false,
  "action": "none",
  "reason": "dry_run=true prevents execution"
}
```

Safety: no execution occurs.

## 8. Run Guarded Execution Safe Mode

To allow a local guarded decision, explicitly set the flag and disable dry-run.

```bash
CLAWSWEEPER_ENABLE_GUARDED_EXECUTION=1 pnpm run guarded-execution -- \
  --policy policies/safe-annotation-policy.json \
  --metrics results/shadow-metrics/<timestamp>.json \
  --confidence fixtures/confidence-high.json \
  --item-number 42 \
  --dry-run false
```

Allowed actions in v0.6:

- `annotate_only`
- `suggest_comment`

Expected output:

```text
results/guarded-execution/<timestamp>-<policy-id>-<item-number>.json
```

Even in safe mode, v0.6 only writes a local decision log. It does not mutate GitHub, close issues, merge PRs, dispatch repairs, modify repository state, or alter scheduler/apply/automerge behavior.
