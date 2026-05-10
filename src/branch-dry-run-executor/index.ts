#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs, stringArg } from "../clawsweeper-args.js";
import { sortStable } from "../stable-json.js";
import { planBranchDryRunExecution, renderBranchDryRunExecutorMarkdown } from "./executor.js";
import type { BranchDryRunExecutorRunOptions, BranchDryRunExecutorRunResult } from "./types.js";

export { planBranchDryRunExecution, renderBranchDryRunExecutorMarkdown } from "./executor.js";
export type * from "./types.js";

export function runBranchDryRunExecutor(
  options: BranchDryRunExecutorRunOptions,
): BranchDryRunExecutorRunResult {
  const preview = planBranchDryRunExecution({
    branchIntent: readJsonIfExists(options.branchIntentPath),
  });
  const outputRoot = resolve(options.outputRoot);
  const jsonPath = join(outputRoot, "branch-dry-run-executor.json");
  const markdownPath = join(outputRoot, "branch-dry-run-executor.md");
  const markdown = renderBranchDryRunExecutorMarkdown(preview);
  writeJson(jsonPath, preview);
  mkdirSync(dirname(markdownPath), { recursive: true });
  writeFileSync(markdownPath, markdown, "utf8");
  return { preview, markdown, jsonPath, markdownPath };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const branchIntentPath = stringArg(args.branch_intent, "");
  const outputRoot = stringArg(args.output_root, "results/branch-dry-run-executor");
  if (!branchIntentPath) {
    console.error(
      "Usage: pnpm run branch-dry-run-executor -- --branch-intent <path> --output-root <path>",
    );
    process.exitCode = 1;
    return;
  }
  const result = runBranchDryRunExecutor({ branchIntentPath, outputRoot });
  console.log(`Branch dry-run executor JSON written: ${result.jsonPath}`);
  console.log(`Branch dry-run executor report written: ${result.markdownPath}`);
  console.log(`Status: ${result.preview.status}`);
  console.log(`Would execute: ${String(result.preview.would_execute)}`);
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
