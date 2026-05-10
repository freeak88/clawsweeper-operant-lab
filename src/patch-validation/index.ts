#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs, stringArg } from "../clawsweeper-args.js";
import { sortStable } from "../stable-json.js";
import { renderPatchValidationMarkdown, validatePatchProposal } from "./validator.js";
import type { PatchValidationRunOptions, PatchValidationRunResult } from "./types.js";

export { renderPatchValidationMarkdown, validatePatchProposal } from "./validator.js";
export type * from "./types.js";

export function runPatchValidation(options: PatchValidationRunOptions): PatchValidationRunResult {
  const validation = validatePatchProposal(readJsonIfExists(options.patchPath));
  const outputRoot = resolve(options.outputRoot);
  const jsonPath = join(outputRoot, "patch-validation.json");
  const markdownPath = join(outputRoot, "patch-validation.md");
  const markdown = renderPatchValidationMarkdown(validation);
  writeJson(jsonPath, validation);
  mkdirSync(dirname(markdownPath), { recursive: true });
  writeFileSync(markdownPath, markdown, "utf8");
  return { validation, markdown, jsonPath, markdownPath };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const patchPath = stringArg(args.patch, "");
  const outputRoot = stringArg(args.output_root, "results/patch-validation");
  if (!patchPath) {
    console.error("Usage: pnpm run patch-validation -- --patch <path> --output-root <path>");
    process.exitCode = 1;
    return;
  }
  const result = runPatchValidation({ patchPath, outputRoot });
  console.log(`Patch validation JSON written: ${result.jsonPath}`);
  console.log(`Patch validation written: ${result.markdownPath}`);
  console.log(`Status: ${result.validation.status}`);
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
