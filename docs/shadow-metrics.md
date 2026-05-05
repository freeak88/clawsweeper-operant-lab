# Shadow Accuracy Metrics

Shadow Accuracy Metrics analyze Shadow Runtime reports and summarize how approved policies behaved during dry-run evaluation. The output is policy-level evidence for deciding whether a policy may be worth future guarded execution work.

This layer is reporting-only. It does not execute policies, mutate GitHub, close issues, merge PRs, dispatch repairs, or change scheduler, apply, or automerge behavior.

## CLI Usage

```bash
pnpm run shadow-metrics -- --reports results/shadow-runtime/openclaw-openclaw
```

The command reads one or more Shadow Runtime JSON reports and writes:

```text
results/shadow-metrics/<timestamp>.json
```

Malformed or non-report JSON files are skipped with warnings so historical report directories can contain partial or old data without crashing analysis.

## Metrics

The generated report includes:

- `policy_count`
- `total_matches`
- `matches_by_policy`
- `would_action_counts`
- `average_confidence_by_policy`
- `blocked_count`
- `risk_count_by_policy`
- `high_confidence_match_count`
- `low_confidence_match_count`
- per-policy `candidate_for_guarded_execution`
- per-policy `candidate_reason`

## Thresholds

Default thresholds are conservative:

- minimum observations: `5`
- minimum average confidence: `0.8`
- maximum risk count per policy: `1`
- high-confidence threshold: `0.8`
- low-confidence threshold: `0.4`
- future execution allowlist: `annotate_only`, `propose_close`

The TypeScript API accepts threshold overrides for experiments. The CLI uses defaults in v0.5.

## Candidate Criteria

A policy can be marked `candidate_for_guarded_execution: true` only when all of the following are true:

- enough shadow observations exist
- average confidence is high
- no matches are blocked
- risk count is low
- all observed would-actions are on the conservative future-execution allowlist

This flag is advisory metadata. It does not promote, execute, or wire policies into runtime behavior.

## Relationship To Shadow Runtime

v0.4 Shadow Runtime answers: "What would approved Policy DSL rules have proposed against Review Memory?"

v0.5 Shadow Accuracy Metrics answers: "Which approved policies look stable enough to discuss as future guarded-execution candidates?"

The boundary remains dry-run and reporting-only.
