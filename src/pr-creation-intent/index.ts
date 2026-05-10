#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs, stringArg } from "../clawsweeper-args.js";
import { sortStable } from "../stable-json.js";
import { planPrCreationIntent, renderPrCreationIntentMarkdown } from "./planner.js";
import type { PrCreationIntentRunOptions, PrCreationIntentRunResult } from "./types.js";

export { planPrCreationIntent, renderPrCreationIntentMarkdown } from "./planner.js";
export type * from "./types.js";

export function runPrCreationIntent(
  options: PrCreationIntentRunOptions,
): PrCreationIntentRunResult {
  const intent = planPrCreationIntent({
    patch: readJsonIfExists(options.patchPath),
    validation: readJsonIfExists(options.validationPath),
    shadow: readJsonIfExists(options.shadowPath),
    approval: readJsonIfExists(options.approvalPath),
  });
  const outputRoot = resolve(options.outputRoot);
  const jsonPath = join(outputRoot, "pr-creation-intent.json");
  const markdownPath = join(outputRoot, "pr-creation-intent.md");
  const markdown = renderPrCreationIntentMarkdown(intent);
  writeJson(jsonPath, intent);
  mkdirSync(dirname(markdownPath), { recursive: true });
  writeFileSync(markdownPath, markdown, "utf8");
  return { intent, markdown, jsonPath, markdownPath };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const patchPath = stringArg(args.patch, "");
  const validationPath = stringArg(args.validation, "");
  const shadowPath = stringArg(args.shadow, "");
  const approvalPath = stringArg(args.approval, "");
  const outputRoot = stringArg(args.output_root, "results/pr-creation-intent");
  if (!patchPath || !validationPath || !shadowPath || !approvalPath) {
    console.error(
      "Usage: pnpm run pr-creation-intent -- --patch <path> --validation <path> --shadow <path> --approval <path> --output-root <path>",
    );
    process.exitCode = 1;
    return;
  }
  const result = runPrCreationIntent({
    patchPath,
    validationPath,
    shadowPath,
    approvalPath,
    outputRoot,
  });
  console.log(`PR creation intent JSON written: ${result.jsonPath}`);
  console.log(`PR creation intent written: ${result.markdownPath}`);
  console.log(`Status: ${result.intent.status}`);
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
