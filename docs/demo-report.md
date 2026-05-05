# Demo Report Generator

The Demo Report Generator creates a local, structured ClawSweeper Operant Lab report for a GitHub repository input. It is designed for demos, sales conversations, and operator review where the useful question is: what would the Operant pipeline infer from existing local evidence?

It does not contact GitHub. It reads only local durable records and local generated Operant Lab artifacts.

## CLI Usage

```bash
pnpm run demo-report -- --repo https://github.com/openclaw/openclaw
```

Accepted repository formats:

```text
https://github.com/openclaw/openclaw
git@github.com:openclaw/openclaw.git
openclaw/openclaw
```

Optional flags:

```bash
pnpm run demo-report -- \
  --repo openclaw/openclaw \
  --output-root results/demo-report \
  --records-root records \
  --policy-rfc-root results/policy-rfc \
  --max-records 50 \
  --min-occurrences 3 \
  --generated-at 2026-05-05T12:00:00.000Z
```

## Local Records Only

v0.7 prefers local generated state only:

- durable records under `records/<repo-slug>/`
- local Policy RFC artifacts under `results/policy-rfc/<repo-slug>/`
- locally generated Review Memory, Policy DSL, Shadow Runtime, and Shadow Metrics artifacts

If no local records exist, the command still writes `demo-report.md` and `demo-report.json` and states:

- No durable records found for this repository.
- No GitHub API calls were made.
- No actions were executed.

## Output Layout

```text
results/demo-report/<repo-slug>/
  demo-report.md
  demo-report.json
  artifacts/
    review-memory.json
    policy-rfc/
    policy-dsl/
    shadow-runtime.json
    shadow-metrics.json
```

The JSON report includes record counts, pattern counts, generated proposal counts, shadow match counts, candidate counts, artifact paths, and the hard safety boundary.

## Safety Boundary

The report generator hard-codes:

```json
{
  "github_mutation": false,
  "execution_enabled": false,
  "guarded_execution": false,
  "repair_dispatch": false,
  "issue_close": false,
  "pr_merge": false
}
```

It does not run guarded execution, even in dry-run mode. It does not close issues, merge pull requests, dispatch repairs, mutate repository state, or alter scheduler/apply/automerge behavior.

## Difference From Automation Lanes

ClawSweeper scheduler lanes choose and process work. The Demo Report Generator is outside that path. It is a local report synthesizer that reuses Operant Lab analysis modules to produce a readable and machine-readable demo artifact.

## Demo and Sales Use

The generated Markdown report is intentionally concise:

- what records were available
- what patterns were detected
- what policy artifacts were proposed
- what shadow evaluation found
- why no execution occurred
- what the safe next step would be

This makes it useful for showing conservative automation behavior without requiring live credentials or GitHub write permissions.
