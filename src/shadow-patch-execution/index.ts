#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs, stringArg } from "../clawsweeper-args.js";
import { sortStable } from "../stable-json.js";
import { executeShadowPatch, renderShadowPatchExecutionMarkdown } from "./executor.js";
import type { ShadowPatchExecutionRunOptions, ShadowPatchExecutionRunResult } from "./types.js";

export { executeShadowPatch, renderShadowPatchExecutionMarkdown } from "./executor.js";
export type * from "./types.js";

export function runShadowPatchExecution(
  options: ShadowPatchExecutionRunOptions,
): ShadowPatchExecutionRunResult {
  const execution = executeShadowPatch({
    patch: readJsonIfExists(options.patchPath),
    validation: readJsonIfExists(options.validationPath),
  });
  const outputRoot = resolve(options.outputRoot);
  const jsonPath = join(outputRoot, "shadow-patch-execution.json");
  const markdownPath = join(outputRoot, "shadow-patch-execution.md");
  const markdown = renderShadowPatchExecutionMarkdown(execution);
  writeJson(jsonPath, execution);
  mkdirSync(dirname(markdownPath), { recursive: true });
  writeFileSync(markdownPath, markdown, "utf8");
  return { execution, markdown, jsonPath, markdownPath };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const patchPath = stringArg(args.patch, "");
  const validationPath = stringArg(args.validation, "");
  const outputRoot = stringArg(args.output_root, "results/shadow-patch-execution");
  if (!patchPath || !validationPath) {
    console.error(
      "Usage: pnpm run shadow-patch-execution -- --patch <path> --validation <path> --output-root <path>",
    );
    process.exitCode = 1;
    return;
  }
  const result = runShadowPatchExecution({ patchPath, validationPath, outputRoot });
  console.log(`Shadow patch execution JSON written: ${result.jsonPath}`);
  console.log(`Shadow patch execution written: ${result.markdownPath}`);
  console.log(`Status: ${result.execution.status}`);
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
