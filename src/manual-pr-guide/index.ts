#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs, stringArg } from "../clawsweeper-args.js";
import { sortStable } from "../stable-json.js";
import { generateManualPrGuide, renderManualPrGuideMarkdown } from "./generator.js";
import type { ManualPrGuideRunOptions, ManualPrGuideRunResult } from "./types.js";

export { generateManualPrGuide, renderManualPrGuideMarkdown } from "./generator.js";
export type * from "./types.js";

export function runManualPrGuide(options: ManualPrGuideRunOptions): ManualPrGuideRunResult {
  const guide = generateManualPrGuide({
    prPackage: readJsonIfExists(options.prPackagePath),
    branchIntent: readJsonIfExists(options.branchIntentPath),
    commitExecution: readJsonIfExists(options.commitExecutionPath),
  });
  const outputRoot = resolve(options.outputRoot);
  const jsonPath = join(outputRoot, "manual-pr-guide.json");
  const markdownPath = join(outputRoot, "manual-pr-guide.md");
  const markdown = renderManualPrGuideMarkdown(guide);
  writeJson(jsonPath, guide);
  mkdirSync(dirname(markdownPath), { recursive: true });
  writeFileSync(markdownPath, markdown, "utf8");
  return { guide, markdown, jsonPath, markdownPath };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const prPackagePath = stringArg(args.pr_package, "");
  const branchIntentPath = stringArg(args.branch_intent, "");
  const commitExecutionPath = stringArg(args.commit_execution, "");
  const outputRoot = stringArg(args.output_root, "results/manual-pr-guide");
  if (!prPackagePath || !branchIntentPath || !commitExecutionPath) {
    console.error(
      "Usage: pnpm run manual-pr-guide -- --pr-package <path> --branch-intent <path> --commit-execution <path> --output-root <path>",
    );
    process.exitCode = 1;
    return;
  }
  const result = runManualPrGuide({
    prPackagePath,
    branchIntentPath,
    commitExecutionPath,
    outputRoot,
  });
  console.log(`Manual PR guide JSON written: ${result.jsonPath}`);
  console.log(`Manual PR guide report written: ${result.markdownPath}`);
  console.log(`Status: ${result.guide.status}`);
  console.log(`Recommended next step: ${result.guide.recommended_next_step}`);
}

function readJsonIfExists(path: string): unknown {
  const resolved = resolve(path);
  if (!existsSync(resolved)) return undefined;
  return JSON.parse(readFileSync(resolved, "utf8")) as unknown;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(sortStable(value), null, 2)}\n`, "utf8");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
