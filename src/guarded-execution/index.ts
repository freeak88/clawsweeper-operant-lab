#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { boolArg, numberArg, parseArgs, stringArg } from "../clawsweeper-args.js";
import { runGuardedExecution } from "./engine.js";

export { evaluateGuardedExecution, runGuardedExecution } from "./engine.js";
export type * from "./types.js";

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const policyPath = stringArg(args.policy, "");
  const metricsPath = stringArg(args.metrics, "");
  const confidencePath = stringArg(args.confidence, "");
  const itemNumber = numberArg(args.item_number, 0);
  const outputRoot = stringArg(args.output_root, "results/guarded-execution");
  const generatedAt = typeof args.generated_at === "string" ? args.generated_at : undefined;
  const dryRun = args.dry_run === undefined ? true : boolArg(args.dry_run);

  if (!policyPath || !metricsPath || !confidencePath || itemNumber <= 0) {
    console.error(
      "Usage: pnpm run guarded-execution -- --policy <path> --metrics <path> --confidence <path> --item-number <number> [--dry-run true|false]",
    );
    process.exitCode = 1;
    return;
  }

  const result = runGuardedExecution({
    policyPath,
    metricsPath,
    confidencePath,
    itemNumber,
    dryRun,
    outputRoot,
    generatedAt,
  });
  if (!result.ok) {
    console.error(result.error ?? "Guarded execution failed");
    process.exitCode = 1;
    return;
  }

  console.log(`Guarded execution log written: ${result.outputPath}`);
  console.log(
    `Decision: executed=${result.decision?.executed ?? false}; action=${result.decision?.action ?? "none"}; reason=${result.decision?.reason ?? ""}`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
