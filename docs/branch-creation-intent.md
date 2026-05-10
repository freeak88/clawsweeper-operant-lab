# Dry-run Branch Creation Intent

Dry-run Branch Creation Intent is the first Camino D artifact. It prepares a
safe branch creation package from a ready PR Creation Intent without creating
the branch.

It does not run `git branch`, `git checkout`, commit, push, create PRs, call the
GitHub API, mutate source files, or change scheduler/apply/automerge behavior.

## Input

- `pr-creation-intent.json`
- optional local refs file

The source PR intent must have `status: "ready"`.

## Output

- `branch-creation-intent.json`
- `branch-creation-intent.md`

## CLI Usage

```bash
pnpm run branch-creation-intent -- --pr-intent results/pr-creation-intent/pr-creation-intent.json --output-root results/branch-creation-intent --base-ref main
```

Optional local refs input:

```bash
pnpm run branch-creation-intent -- --pr-intent results/pr-creation-intent/pr-creation-intent.json --local-refs local-refs.txt --output-root results/branch-creation-intent --base-ref main
```

The local refs file may be a JSON array, an object with a `refs` array, or a
newline-delimited text file.

## Safety Checks

- Source PR intent is ready.
- Base ref is explicit.
- Branch name is deterministic and sanitized.
- Branch name is not protected.
- Branch name does not already appear in the optional local refs input.

Protected branch names:

- `main`
- `master`
- `develop`
- `release/*`
- `hotfix/*`

## Safety Boundary

- No branch creation.
- No checkout.
- No commit.
- No push.
- No PR creation.
- No GitHub API calls.
- No GitHub or source mutation.
- No scheduler/apply/automerge behavior change.

## Future Path

A future guarded branch creation layer may consume this intent, but that layer
must remain explicit, audited, and operator-controlled. This D1 layer only
prepares the dry-run intent.
