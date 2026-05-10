# Commit Intent

D6 adds a commit intent layer. It converts a passed isolated validation result
into a reviewable commit package.

It does not stage files or create commits.

## Purpose

The flow is:

```text
validated isolated workspace
→ commit intent
→ commit message
→ files expected
→ validation evidence
→ rollback note
→ manual commit review
```

## CLI

```bash
pnpm run commit-intent -- \
  --validation results/local-validation-runner/local-validation-result.json \
  --application results/isolated-patch-application/isolated-patch-application.json \
  --patch results/patch-generation/patch-proposal.json \
  --output-root results/commit-intent
```

## Output

The command writes:

```text
commit-intent.json
commit-intent.md
```

The JSON contains:

```json
{
  "commit_intent_id": "commit-intent-patch-plan-example",
  "patch_id": "patch-plan-example",
  "status": "ready",
  "proposed_commit_message": "feat: example",
  "files_expected": [],
  "validation_evidence": [],
  "rollback_note": "...",
  "recommended_next_step": "manual_commit_review",
  "blocked_reason": null
}
```

## Safety Boundary

D6 does not:

- run `git add`
- stage files
- run `git commit`
- push
- create PRs
- call the GitHub API
- mutate source files
- change scheduler behavior
- change apply or automerge behavior

## Future Path

A future D7 layer can add guarded local commit execution, but it should require
explicit operator approval and should continue to preserve rollback evidence.
