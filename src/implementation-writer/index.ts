#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs, stringArg } from "../clawsweeper-args.js";
import { sortStable } from "../stable-json.js";
import { writeImplementationPromptFromPlan } from "./writer.js";
import type {
  ImplementationWriterPlanInput,
  ImplementationWriterRunOptions,
  ImplementationWriterRunResult,
} from "./types.js";

export { renderPromptMarkdown, writeImplementationPromptFromPlan } from "./writer.js";
export type * from "./types.js";

export function runImplementationWriter(
  options: ImplementationWriterRunOptions,
): ImplementationWriterRunResult {
  const plan = readJsonIfExists(options.planPath) as ImplementationWriterPlanInput;
  const result = writeImplementationPromptFromPlan(plan);
  const outputRoot = resolve(options.outputRoot);
  const jsonPath = join(outputRoot, "implementation-prompt.json");
  const markdownPath = join(outputRoot, "implementation-prompt.md");
  writeJson(jsonPath, result.output);
  if (result.markdown) {
    mkdirSync(dirname(markdownPath), { recursive: true });
    writeFileSync(markdownPath, result.markdown, "utf8");
    return { output: result.output, markdown: result.markdown, jsonPath, markdownPath };
  }
  return { output: result.output, jsonPath };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const planPath = stringArg(args.plan, "");
  const outputRoot = stringArg(args.output_root, "results/implementation-writer");
  if (!planPath) {
    console.error("Usage: pnpm run implementation-writer -- --plan <path> --output-root <path>");
    process.exitCode = 1;
    return;
  }
  const result = runImplementationWriter({ planPath, outputRoot });
  console.log(`Implementation prompt JSON written: ${result.jsonPath}`);
  if (result.markdownPath) console.log(`Implementation prompt written: ${result.markdownPath}`);
  console.log(`Status: ${result.output.status}`);
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
