# Supervised Patch Generation

The Supervised Patch Generation layer converts an approved implementation plan into a deterministic patch proposal artifact.

It does not apply patches. It does not modify source files as generated output. It does not create commits, pushes, pull requests, merges, repair dispatches, or GitHub mutations.

## Position In The Pipeline

```text
Autonomous Improvement Loop
  -> Operator Approval Gate
  -> Supervised Implementation Writer
  -> Supervised Patch Generation
  -> future supervised patch validation
```

The layer consumes the planning artifacts from earlier gates and produces `patch-proposal.md` plus `patch-proposal.json`.

## Input

Required:

- approved implementation plan JSON

Optional:

- implementation prompt JSON
- implementation prompt Markdown

The plan must have:

```json
{
  "status": "approved_for_planning",
  "approval_scope": "implementation_plan_only"
}
```

Anything else fails closed.

## CLI Usage

```bash
pnpm run patch-generation -- \
  --plan results/approval-gate/improve-scheduler.json \
  --output-root results/patch-generation/improve-scheduler
```

With optional implementation prompt context:

```bash
pnpm run patch-generation -- \
  --plan plan.json \
  --prompt-json implementation-prompt.json \
  --prompt-markdown implementation-prompt.md \
  --output-root results/patch-generation/improve-scheduler
```

## Output

```text
patch-proposal.md
patch-proposal.json
```

The JSON shape is:

```json
{
  "patch_id": "...",
  "plan_id": "...",
  "proposal_id": "...",
  "status": "patch_proposed",
  "summary": "This is not an applied patch.",
  "intended_changes": [],
  "files_to_modify": [],
  "files_to_add": [],
  "tests_to_run": [],
  "rollback_plan": [],
  "safety_constraints": [],
  "non_goals": [],
  "blocked_reason": null
}
```

## Safety Boundary

Patch Generation explicitly does not:

- apply patches
- modify source files as generated output
- create commits
- push branches
- create PRs
- merge PRs
- mutate GitHub
- dispatch repairs
- change scheduler/apply/automerge behavior

The generated proposal must be reviewed by a human before any future patch validation or implementation step.

## Future Path

The safe next step is patch validation: check whether a proposed patch would be internally coherent, testable, reversible, and still within the approved plan before any supervised implementation session writes files.
