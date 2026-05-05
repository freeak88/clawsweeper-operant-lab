# Supervised Implementation Writer

The Supervised Implementation Writer converts an Operator Approval Gate implementation plan into a deterministic Codex-ready prompt.

It does not execute the prompt. It does not create code changes. It does not create commits, branches, pull requests, pushes, merges, repair dispatches, or GitHub mutations.

## Position In The Pipeline

```text
Autonomous Improvement Loop
  -> Operator Approval Gate
  -> Supervised Implementation Writer
  -> human-supervised implementation session
```

The Approval Gate authorizes planning only. The Implementation Writer preserves that boundary by producing prompt artifacts rather than running an implementation.

## CLI Usage

```bash
pnpm run implementation-writer -- \
  --plan results/approval-gate/improve-scheduler-saturated_backlog-1234abcd.json \
  --output-root results/implementation-writer/improve-scheduler-saturated_backlog-1234abcd
```

Outputs:

```text
implementation-prompt.md
implementation-prompt.json
```

## Prompt Contents

The Markdown prompt includes:

- goal
- context
- exact scope
- files likely changed
- implementation steps
- tests required
- rollback plan
- safety constraints
- non-goals
- final response requirements

## Blocking Rules

The writer fails closed when:

- plan status is not `approved_for_planning`
- approval scope is not `implementation_plan_only`
- required plan fields are missing
- the plan artifact is missing or malformed

Blocked runs write `implementation-prompt.json` with `status: "blocked"` and do not write a Markdown implementation prompt.

## Safety Boundary

Generated prompts explicitly prohibit:

- automatic code execution
- commit creation
- PR creation
- branch pushes
- GitHub mutation
- repair dispatch
- scheduler/apply/automerge behavior changes outside the approved local scope
- test bypasses
- autonomous execution language

## Future Path

A future supervised patch-generation workflow can consume these prompts as human-reviewed task briefs. That future workflow should remain separate from approval and should require explicit operator action before any file edits, commits, pushes, or PR creation.
