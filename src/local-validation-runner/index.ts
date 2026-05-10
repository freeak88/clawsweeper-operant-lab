#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { boolArg, parseArgs, stringArg } from "../clawsweeper-args.js";
import { sortStable } from "../stable-json.js";
import { renderLocalValidationMarkdown, runLocalValidation } from "./runner.js";
import type { LocalValidationRunnerRunOptions, LocalValidationRunnerRunResult } from "./types.js";

export {
  createDefaultLocalValidationCommandRunner,
  renderLocalValidationMarkdown,
  runLocalValidation,
} from "./runner.js";
export type * from "./types.js";

export function runLocalValidationRunner(
  options: LocalValidationRunnerRunOptions,
): LocalValidationRunnerRunResult {
  const outputRoot = resolve(options.outputRoot);
  const validation = runLocalValidation({
    application: readJsonIfExists(options.applicationPath),
    patch: readJsonIfExists(options.patchPath),
    outputRoot,
    execute: options.execute === true,
  });
  const jsonPath = join(outputRoot, "local-validation-result.json");
  const markdownPath = join(outputRoot, "local-validation-result.md");
  const markdown = renderLocalValidationMarkdown(validation);
  writeJson(jsonPath, validation);
  mkdirSync(dirname(markdownPath), { recursive: true });
  writeFileSync(markdownPath, markdown, "utf8");
  return { validation, markdown, jsonPath, markdownPath };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const applicationPath = stringArg(args.application, "");
  const patchPath = stringArg(args.patch, "");
  const outputRoot = stringArg(args.output_root, "results/local-validation-runner");
  const execute = boolArg(args.execute);
  if (!applicationPath || !patchPath) {
    console.error(
      "Usage: pnpm run local-validation-runner -- --application <path> --patch <path> --output-root <path> [--execute]",
    );
    process.exitCode = 1;
    return;
  }
  const result = runLocalValidationRunner({ applicationPath, patchPath, outputRoot, execute });
  console.log(`Local validation JSON written: ${result.jsonPath}`);
  console.log(`Local validation report written: ${result.markdownPath}`);
  console.log(`Status: ${result.validation.status}`);
  console.log(`Did execute: ${String(result.validation.did_execute)}`);
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
