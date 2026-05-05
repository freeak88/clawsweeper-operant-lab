#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs, stringArg } from "../clawsweeper-args.js";
import { runShadowRuntime } from "./runner.js";

export { buildShadowRuntimeReport, runShadowRuntime } from "./runner.js";
export type * from "./types.js";

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const policiesDir = stringArg(args.policies, "");
  const memoryPath = stringArg(args.memory, "");
  const outputRoot = stringArg(args.output_root, "results/shadow-runtime");
  const generatedAt = typeof args.generated_at === "string" ? args.generated_at : undefined;

  if (!policiesDir || !memoryPath) {
    console.error("Usage: pnpm run shadow-runtime -- --policies <dir> --memory <path>");
    process.exitCode = 1;
    return;
  }

  const result = runShadowRuntime({
    policiesDir,
    memoryPath,
    outputRoot,
    generatedAt,
  });
  for (const warning of result.warnings) console.warn(`Warning: ${warning}`);
  if (!result.ok) {
    console.error(result.error ?? "Shadow runtime failed");
    process.exitCode = 1;
    return;
  }

  console.log(`Shadow runtime report written: ${result.outputPath}`);
  console.log(
    `Evaluated ${result.report?.summary.policy_count ?? 0} policy(s) across ${result.report?.summary.item_count ?? 0} item(s); ${result.report?.summary.match_count ?? 0} match(es).`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
