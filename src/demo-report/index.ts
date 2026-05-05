#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { numberArg, parseArgs, stringArg } from "../clawsweeper-args.js";
import { normalizeDemoRepoInput } from "./repo.js";
import { runDemoReport } from "./runner.js";

export { normalizeDemoRepoInput } from "./repo.js";
export { DEMO_REPORT_SAFETY_BOUNDARY, runDemoReport } from "./runner.js";
export { synthesizeDemoReportMarkdown } from "./synthesizer.js";
export type * from "./types.js";

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const repoInput = stringArg(args.repo, "");
  if (!repoInput) {
    console.error("Usage: pnpm run demo-report -- --repo <github-url-or-owner/repo>");
    process.exitCode = 1;
    return;
  }

  try {
    const result = runDemoReport({
      repoInput,
      outputRoot: resolve(stringArg(args.output_root, "results/demo-report")),
      recordsRoot: resolve(stringArg(args.records_root, "records")),
      policyRfcRoot: resolve(stringArg(args.policy_rfc_root, "results/policy-rfc")),
      maxRecords: numberArg(args.max_records, 50),
      minOccurrences: numberArg(args.min_occurrences, 3),
      generatedAt: typeof args.generated_at === "string" ? args.generated_at : undefined,
    });
    console.log(`Demo report written: ${result.markdownPath}`);
    console.log(`Demo report JSON: ${result.jsonPath}`);
    console.log(
      `Records: ${result.report.input.record_count}; patterns: ${result.report.summary.pattern_count}; shadow matches: ${result.report.summary.shadow_match_count}; executions: ${result.report.summary.executed_count}`,
    );
    if (result.warnings.length > 0) console.log(`Warnings: ${result.warnings.join("; ")}`);
  } catch (error) {
    if (repoInput) normalizeDemoRepoInput(repoInput);
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
