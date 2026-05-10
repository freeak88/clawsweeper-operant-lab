#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs, stringArg } from "../clawsweeper-args.js";
import { sortStable } from "../stable-json.js";
import { planCommitIntent, renderCommitIntentMarkdown } from "./planner.js";
import type { CommitIntentRunOptions, CommitIntentRunResult } from "./types.js";

export { planCommitIntent, renderCommitIntentMarkdown } from "./planner.js";
export type * from "./types.js";

export function runCommitIntent(options: CommitIntentRunOptions): CommitIntentRunResult {
  const intent = planCommitIntent({
    validation: readJsonIfExists(options.validationPath),
    application: readJsonIfExists(options.applicationPath),
    patch: readJsonIfExists(options.patchPath),
  });
  const outputRoot = resolve(options.outputRoot);
  const jsonPath = join(outputRoot, "commit-intent.json");
  const markdownPath = join(outputRoot, "commit-intent.md");
  const markdown = renderCommitIntentMarkdown(intent);
  writeJson(jsonPath, intent);
  mkdirSync(dirname(markdownPath), { recursive: true });
  writeFileSync(markdownPath, markdown, "utf8");
  return { intent, markdown, jsonPath, markdownPath };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const validationPath = stringArg(args.validation, "");
  const applicationPath = stringArg(args.application, "");
  const patchPath = stringArg(args.patch, "");
  const outputRoot = stringArg(args.output_root, "results/commit-intent");
  if (!validationPath || !applicationPath || !patchPath) {
    console.error(
      "Usage: pnpm run commit-intent -- --validation <path> --application <path> --patch <path> --output-root <path>",
    );
    process.exitCode = 1;
    return;
  }
  const result = runCommitIntent({ validationPath, applicationPath, patchPath, outputRoot });
  console.log(`Commit intent JSON written: ${result.jsonPath}`);
  console.log(`Commit intent report written: ${result.markdownPath}`);
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
