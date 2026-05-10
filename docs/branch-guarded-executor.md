# Guarded Local Branch Creation

The Guarded Local Branch Creation executor is the D3 Camino D layer. It is the
first local-mutation-adjacent layer that can create a local branch, but only
when explicitly invoked with `--execute`.

Default mode is dry-run.

## Purpose

D1 creates a branch creation intent. D2 creates a guarded command preview. D3
checks both artifacts and can create the local branch only after all local safety
checks pass.

```text
branch creation intent
→ guarded command preview
→ guarded local branch creation
→ rollback instruction
→ local validation
```

## CLI

Default dry-run:

```bash
pnpm run branch-guarded-executor -- \
  --branch-intent results/branch-creation-intent/branch-creation-intent.json \
  --preview results/branch-dry-run-executor/branch-dry-run-executor.json \
  --output-root results/branch-guarded-executor
```

Execute mode:

```bash
pnpm run branch-guarded-executor -- \
  --branch-intent results/branch-creation-intent/branch-creation-intent.json \
  --preview results/branch-dry-run-executor/branch-dry-run-executor.json \
  --output-root results/branch-guarded-executor \
  --execute
```

## Safety Checks

Execution requires:

- branch intent status `ready`
- dry-run preview status `ready`
- preview `would_execute` is `false`
- preview command matches the deterministic expected command
- working tree is clean
- current branch is not the proposed branch
- target branch does not already exist locally
- base ref exists locally

Protected branch names are blocked:

- `main`
- `master`
- `develop`
- `release/*`
- `hotfix/*`

## Output

The executor writes:

```text
results/branch-guarded-executor/
  branch-guarded-execution.json
  branch-guarded-execution.md
```

The JSON contains:

```json
{
  "execution_id": "branch-guarded-branch-intent-example",
  "branch_intent_id": "branch-intent-example",
  "status": "dry_run",
  "would_execute": false,
  "did_execute": false,
  "command": "git checkout -b \"operator/example\" \"main\"",
  "safety_checks": [],
  "rollback_instruction": "git checkout \"main\" && git branch -D \"operator/example\"",
  "recommended_next_step": "stop",
  "blocked_reason": null
}
```

## Rollback

Every output includes a rollback instruction. For created branches, the rollback
form is:

```bash
git checkout "main" && git branch -D "operator/example"
```

## Safety Boundary

D3 is local-only.

It does not:

- push
- create commits
- create PRs
- call the GitHub API
- dispatch repairs
- change scheduler behavior
- change apply or automerge behavior

## Future Path

The next safe step is isolated patch application after local branch creation,
still behind explicit operator approval and rollback logging.
