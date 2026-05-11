#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { boolArg, parseArgs, stringArg } from "../clawsweeper-args.js";
import { sortStable } from "../stable-json.js";
import { executeCommitGuarded, renderCommitGuardedExecutionMarkdown } from "./executor.js";
import type { CommitGuardedExecutorRunOptions, CommitGuardedExecutorRunResult } from "./types.js";

export {
  createDefaultGitRunner,
  executeCommitGuarded,
  renderCommitGuardedExecutionMarkdown,
} from "./executor.js";
export type * from "./types.js";

export function runCommitGuardedExecutor(
  options: CommitGuardedExecutorRunOptions,
): CommitGuardedExecutorRunResult {
  const execution = executeCommitGuarded({
    commitIntent: readJsonIfExists(options.commitIntentPath),
    preview: readJsonIfExists(options.previewPath),
    execute: options.execute === true,
  });
  const outputRoot = resolve(options.outputRoot);
  const jsonPath = join(outputRoot, "commit-guarded-execution.json");
  const markdownPath = join(outputRoot, "commit-guarded-execution.md");
  const markdown = renderCommitGuardedExecutionMarkdown(execution);
  writeJson(jsonPath, execution);
  mkdirSync(dirname(markdownPath), { recursive: true });
  writeFileSync(markdownPath, markdown, "utf8");
  return { execution, markdown, jsonPath, markdownPath };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const commitIntentPath = stringArg(args.commit_intent, "");
  const previewPath = stringArg(args.preview, "");
  const outputRoot = stringArg(args.output_root, "results/commit-guarded-executor");
  const execute = boolArg(args.execute);
  if (!commitIntentPath || !previewPath) {
    console.error(
      "Usage: pnpm run commit-guarded-executor -- --commit-intent <path> --preview <path> --output-root <path> [--execute]",
    );
    process.exitCode = 1;
    return;
  }
  const result = runCommitGuardedExecutor({ commitIntentPath, previewPath, outputRoot, execute });
  console.log(`Commit guarded execution JSON written: ${result.jsonPath}`);
  console.log(`Commit guarded execution report written: ${result.markdownPath}`);
  console.log(`Status: ${result.execution.status}`);
  console.log(`Did execute: ${String(result.execution.did_execute)}`);
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
