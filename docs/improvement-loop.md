# Autonomous Improvement Loop

The Autonomous Improvement Loop is a proposal-first layer for finding operational weaknesses and preparing improvement proposals. It does not execute changes. It turns existing Operant Lab evidence into local reports that an operator can review.

## Philosophy

The loop follows the same conservative posture as the rest of Operant Lab:

```text
observe -> propose -> simulate -> prepare reviewable suggestion
```

It is not a self-modifying runtime and it is not an autonomous merge system.

## Inputs

v0.8 accepts planning/status-like and Operant Lab signals:

- saturated backlog
- repeated failed shards
- repeated repair markers
- low-confidence patterns
- recurring conflict types
- stale review queues
- repeated Policy RFC drafts
- model-routing mismatches
- adaptive scheduler recommendations

The CLI accepts a local JSON signal file:

```bash
pnpm run improvement-loop -- --input docs/demo-output/input/improvement-signals.json
```

Optional output root:

```bash
pnpm run improvement-loop -- \
  --input signals.json \
  --output-root results/improvement-loop \
  --generated-at 2026-05-05T12:00:00.000Z
```

## Pipeline

1. Weakness Detection

   Detects operational weaknesses from local input signals.

2. Improvement Proposal Generation

   Produces structured proposal objects:

   ```json
   {
     "proposal_id": "improve-scheduler-saturated_backlog-a1b2c3d4",
     "category": "scheduler",
     "problem_summary": "Due backlog is saturating planned review capacity.",
     "observed_signals": [],
     "proposed_change": "Prepare an operator-reviewed scheduler capacity proposal.",
     "expected_benefit": "Reduce due backlog pressure without changing runtime capacity automatically.",
     "risk_level": "medium",
     "confidence_score": 0.82
   }
   ```

3. Shadow Simulation

   Estimates hypothetical effects with deterministic v0.8 heuristics:
   - backlog reduction
   - shard utilization change
   - confidence improvement
   - repair reduction

   No live execution occurs.

4. Guarded PR Suggestion

   Generates proposal-ready PR suggestion text:

   ```json
   {
     "title": "Proposal: Scheduler improvement...",
     "summary": "This is a proposal-ready PR suggestion only.",
     "safety_notes": ["No GitHub mutation."],
     "affected_systems": ["scheduler"]
   }
   ```

   No PR is created automatically.

## Outputs

```text
results/improvement-loop/<repo-slug>/
  improvement-loop.json
  improvement-loop.md
```

## Safety Model

v0.8 does not:

- merge PRs
- mutate GitHub automatically
- change scheduler behavior automatically
- dispatch repairs automatically
- self-modify runtime behavior automatically
- alter apply/automerge execution paths

The optional flag `CLAWSWEEPER_ENABLE_IMPROVEMENT_LOOP=1` is reserved for future wiring. In v0.8, the module remains local and proposal-first.

## Future Path

The next safe evolution is supervised autonomy:

- compare shadow suggestions against what maintainers actually did
- tune weakness detection thresholds
- promote only stable improvement proposals
- require explicit human approval before any implementation PR is created
