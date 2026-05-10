#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { boolArg, parseArgs, stringArg } from "../clawsweeper-args.js";
import { sortStable } from "../stable-json.js";
import { applyPatchIsolated, renderIsolatedPatchApplicationMarkdown } from "./executor.js";
import type {
  IsolatedPatchApplicationRunOptions,
  IsolatedPatchApplicationRunResult,
} from "./types.js";

export {
  applyPatchIsolated,
  createDefaultIsolatedPatchRunner,
  renderIsolatedPatchApplicationMarkdown,
} from "./executor.js";
export type * from "./types.js";

export function runIsolatedPatchApplication(
  options: IsolatedPatchApplicationRunOptions,
): IsolatedPatchApplicationRunResult {
  const outputRoot = resolve(options.outputRoot);
  const application = applyPatchIsolated({
    patch: readJsonIfExists(options.patchPath),
    validation: readJsonIfExists(options.validationPath),
    branchExecution: readJsonIfExists(options.branchExecutionPath),
    workspaceRoot: options.workspaceRoot,
    outputRoot,
    execute: options.execute === true,
  });
  const jsonPath = join(outputRoot, "isolated-patch-application.json");
  const markdownPath = join(outputRoot, "isolated-patch-application.md");
  const markdown = renderIsolatedPatchApplicationMarkdown(application);
  writeJson(jsonPath, application);
  mkdirSync(dirname(markdownPath), { recursive: true });
  writeFileSync(markdownPath, markdown, "utf8");
  return { application, markdown, jsonPath, markdownPath };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const patchPath = stringArg(args.patch, "");
  const validationPath = stringArg(args.validation, "");
  const branchExecutionPath = stringArg(args.branch_execution, "");
  const workspaceRoot = stringArg(args.workspace_root, "");
  const outputRoot = stringArg(args.output_root, "results/isolated-patch-application");
  const execute = boolArg(args.execute);
  if (!patchPath || !validationPath || !branchExecutionPath) {
    console.error(
      "Usage: pnpm run isolated-patch-application -- --patch <path> --validation <path> --branch-execution <path> --output-root <path> [--workspace-root <path>] [--execute]",
    );
    process.exitCode = 1;
    return;
  }
  const result = runIsolatedPatchApplication({
    patchPath,
    validationPath,
    branchExecutionPath,
    outputRoot,
    workspaceRoot: workspaceRoot || undefined,
    execute,
  });
  console.log(`Isolated patch application JSON written: ${result.jsonPath}`);
  console.log(`Isolated patch application report written: ${result.markdownPath}`);
  console.log(`Status: ${result.application.status}`);
  console.log(`Did apply: ${String(result.application.did_apply)}`);
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
