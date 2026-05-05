import type { DemoReportJson, NormalizedDemoRepo } from "./types.js";

export function synthesizeDemoReportMarkdown(options: {
  repo: NormalizedDemoRepo;
  report: DemoReportJson;
  warnings: readonly string[];
}): string {
  const { repo, report, warnings } = options;
  const noRecords =
    report.input.record_count === 0
      ? [
          "No durable records found for this repository.",
          "No GitHub API calls were made.",
          "No actions were executed.",
        ]
      : [];

  return [
    "# ClawSweeper Operant Lab Demo Report",
    "",
    "## Repository",
    "",
    `- Repository: \`${repo.target_repo}\``,
    `- Repo slug: \`${repo.repo_slug}\``,
    `- Generated at: \`${report.generated_at}\``,
    "",
    "## Input Records",
    "",
    `- Durable records analyzed: ${report.input.record_count}`,
    ...noRecords.map((line) => `- ${line}`),
    ...warnings.map((warning) => `- Warning: ${warning}`),
    "",
    "## Detected Patterns",
    "",
    `- Pattern count: ${report.summary.pattern_count}`,
    "",
    "## Proposed Policies",
    "",
    `- Policy RFC proposals found or generated: ${report.summary.policy_rfc_count}`,
    `- Candidate policies for guarded execution: ${report.summary.candidate_policy_count}`,
    "",
    "## Shadow Results",
    "",
    `- Shadow matches: ${report.summary.shadow_match_count}`,
    "- DSL actions were evaluated as dry-run report entries only.",
    "",
    "## Metrics",
    "",
    `- Executed count: ${report.summary.executed_count}`,
    "- Guarded execution was not invoked.",
    "",
    "## Decision",
    "",
    `- Executed: ${report.decision.executed}`,
    `- Reason: ${report.decision.reason}`,
    "",
    "## What The System Would Have Done",
    "",
    report.summary.shadow_match_count > 0
      ? "- The system would have produced local proposal metadata for matching historical items."
      : "- The system would have done nothing beyond writing this report.",
    "",
    "## What Actually Happened",
    "",
    "- No GitHub API calls were made.",
    "- No actions were executed.",
    "- No scheduler, apply, automerge, repair, issue close, or PR merge path was touched.",
    "",
    "## Safe Next Step",
    "",
    report.input.record_count === 0
      ? "- Add or generate local durable records for this repository, then rerun the report."
      : "- Review the generated artifacts and decide whether any policy should continue through manual promotion.",
    "",
  ].join("\n");
}
