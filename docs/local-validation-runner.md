# Local Validation Runner

D5 adds guarded local validation for isolated patch workspaces. It validates the
workspace produced by D4, not the main working tree.

Default mode is dry-run.

## Purpose

D4 proves that a patch can be applied in a safe zone. D5 proves that the safe
zone can be validated with tightly controlled commands before any commit intent
is considered.

```text
isolated patch application
→ local validation runner
→ allowlisted validation commands
→ commit intent readiness
```

## CLI

Dry-run:

```bash
pnpm run local-validation-runner -- \
  --application results/isolated-patch-application/isolated-patch-application.json \
  --patch results/patch-generation/patch-proposal.json \
  --output-root results/local-validation-runner
```

Execute:

```bash
pnpm run local-validation-runner -- \
  --application results/isolated-patch-application/isolated-patch-application.json \
  --patch results/patch-generation/patch-proposal.json \
  --output-root results/local-validation-runner \
  --execute
```

## Allowlist

Only these command forms are allowed:

- `pnpm run build`
- `pnpm test`
- `node --test`
- `node --test ...`
- `pnpm exec oxlint`
- `pnpm exec oxlint ...`
- `pnpm exec oxfmt --check`
- `pnpm exec oxfmt --check ...`

## Denylist

Commands are blocked if they contain:

- `git`
- `gh`
- `curl`
- `wget`
- `rm -rf`
- `powershell`
- `ssh`
- `scp`
- `npm publish`

## Safety Boundary

D5 does not:

- validate the main working tree
- commit
- push
- create PRs
- call the GitHub API
- change scheduler behavior
- change apply behavior
- change automerge behavior

## Future Path

If validation passes, a future D6 layer can prepare a guarded commit intent. It
should remain artifact-first and require explicit operator approval before any
commit is created.
