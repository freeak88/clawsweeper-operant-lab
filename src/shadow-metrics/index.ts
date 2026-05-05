#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs, stringArg } from "../clawsweeper-args.js";
import { runShadowMetrics } from "./analyzer.js";

export {
  analyzeShadowReports,
  DEFAULT_SHADOW_METRICS_THRESHOLDS,
  runShadowMetrics,
} from "./analyzer.js";
export type * from "./types.js";

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const reportsDir = stringArg(args.reports, "");
  const outputRoot = stringArg(args.output_root, "results/shadow-metrics");
  const generatedAt = typeof args.generated_at === "string" ? args.generated_at : undefined;

  if (!reportsDir) {
    console.error("Usage: pnpm run shadow-metrics -- --reports <dir>");
    process.exitCode = 1;
    return;
  }

  const result = runShadowMetrics({
    reportsDir,
    outputRoot,
    generatedAt,
  });
  for (const warning of result.warnings) console.warn(`Warning: ${warning}`);
  if (!result.ok) {
    console.error(result.error ?? "Shadow metrics failed");
    process.exitCode = 1;
    return;
  }

  console.log(`Shadow metrics report written: ${result.outputPath}`);
  console.log(
    `Analyzed ${result.report?.policy_count ?? 0} policy(s) across ${result.report?.total_matches ?? 0} match(es).`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
