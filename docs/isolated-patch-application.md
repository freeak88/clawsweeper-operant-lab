# Isolated Patch Application

D4 adds guarded isolated patch application. It can apply a patch proposal only
inside an isolated workspace copy, never directly in the main working tree.

Default mode is dry-run.

## Purpose

The governing principle remains:

```text
Evidence → Proposal → Approval → Simulation → Intent → Guarded Local Action
```

D4 is the first step where proposed file changes can be tested in a safe zone.
It exists so the lab can evaluate changes without risking the repository where
the operator is working.

## CLI

Dry-run:

```bash
pnpm run isolated-patch-application -- \
  --patch results/patch-generation/patch-proposal.json \
  --validation results/patch-validation/patch-validation.json \
  --branch-execution results/branch-guarded-executor/branch-guarded-execution.json \
  --output-root results/isolated-patch-application
```

Execute isolated:

```bash
pnpm run isolated-patch-application -- \
  --patch results/patch-generation/patch-proposal.json \
  --validation results/patch-validation/patch-validation.json \
  --branch-execution results/branch-guarded-executor/branch-guarded-execution.json \
  --workspace-root D:/Repos/clawsweeper \
  --output-root D:/Temp/clawsweeper-isolated-application \
  --execute
```

## Safety Checks

Execution requires:

- patch proposal status `patch_proposed`
- patch validation status `valid`
- guarded branch execution status `executed`
- explicit `--execute`
- workspace root
- isolated workspace outside the main repository
- non-empty target files in the patch proposal

## Output

The command writes:

```text
isolated-patch-application.json
isolated-patch-application.md
```

The JSON contains:

```json
{
  "application_id": "isolated-patch-patch-plan-example",
  "patch_id": "patch-plan-example",
  "status": "dry_run",
  "workspace_root": "",
  "isolated_workspace": "results/isolated-patch-application/isolated-workspaces/patch-plan-example",
  "did_apply": false,
  "simulated_files": [],
  "applied_files": [],
  "diff_report": [],
  "rollback_instruction": "No isolated patch was applied; no rollback is required.",
  "recommended_next_step": "stop",
  "blocked_reason": null
}
```

## Diff Report

In dry-run mode, `simulated_files` lists the files that would be considered.
In isolated execution mode, `applied_files` and `diff_report` come from the
isolated application runner.

## Rollback

Every report includes a rollback instruction. If isolated application occurred,
the rollback instruction removes the isolated workspace. The main working tree
is not modified.

## Safety Boundary

D4 does not:

- apply patches to the main working tree
- commit
- push
- create PRs
- call the GitHub API
- change scheduler behavior
- change apply behavior
- change automerge behavior

## Future Path

D5 should run local validation against the isolated workspace: build, tests,
lint, and smoke checks before any commit intent is considered.
