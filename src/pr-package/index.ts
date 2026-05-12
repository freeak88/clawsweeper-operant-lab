#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs, stringArg } from "../clawsweeper-args.js";
import { sortStable } from "../stable-json.js";
import { generatePrPackage, renderPrPackageMarkdown } from "./generator.js";
import type { PrPackageRunOptions, PrPackageRunResult } from "./types.js";

export { generatePrPackage, renderPrPackageMarkdown } from "./generator.js";
export type * from "./types.js";

export function runPrPackage(options: PrPackageRunOptions): PrPackageRunResult {
  const prPackage = generatePrPackage({
    commitExecution: readJsonIfExists(options.commitExecutionPath),
    commitIntent: readJsonIfExists(options.commitIntentPath),
    validation: readJsonIfExists(options.validationPath),
    application: readJsonIfExists(options.applicationPath),
    patch: readJsonIfExists(options.patchPath),
  });
  const outputRoot = resolve(options.outputRoot);
  const jsonPath = join(outputRoot, "pr-package.json");
  const markdownPath = join(outputRoot, "pr-package.md");
  const markdown = renderPrPackageMarkdown(prPackage);
  writeJson(jsonPath, prPackage);
  mkdirSync(dirname(markdownPath), { recursive: true });
  writeFileSync(markdownPath, markdown, "utf8");
  return { prPackage, markdown, jsonPath, markdownPath };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const commitExecutionPath = stringArg(args.commit_execution, "");
  const commitIntentPath = stringArg(args.commit_intent, "");
  const validationPath = stringArg(args.validation, "");
  const applicationPath = stringArg(args.application, "");
  const patchPath = stringArg(args.patch, "");
  const outputRoot = stringArg(args.output_root, "results/pr-package");
  if (
    !commitExecutionPath ||
    !commitIntentPath ||
    !validationPath ||
    !applicationPath ||
    !patchPath
  ) {
    console.error(
      "Usage: pnpm run pr-package -- --commit-execution <path> --commit-intent <path> --validation <path> --application <path> --patch <path> --output-root <path>",
    );
    process.exitCode = 1;
    return;
  }
  const result = runPrPackage({
    commitExecutionPath,
    commitIntentPath,
    validationPath,
    applicationPath,
    patchPath,
    outputRoot,
  });
  console.log(`PR package JSON written: ${result.jsonPath}`);
  console.log(`PR package report written: ${result.markdownPath}`);
  console.log(`Status: ${result.prPackage.status}`);
  console.log(`Recommended next step: ${result.prPackage.recommended_next_step}`);
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
