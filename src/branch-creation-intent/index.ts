#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs, stringArg } from "../clawsweeper-args.js";
import { sortStable } from "../stable-json.js";
import { planBranchCreationIntent, renderBranchCreationIntentMarkdown } from "./planner.js";
import type { BranchCreationIntentRunOptions, BranchCreationIntentRunResult } from "./types.js";

export { planBranchCreationIntent, renderBranchCreationIntentMarkdown } from "./planner.js";
export type * from "./types.js";

export function runBranchCreationIntent(
  options: BranchCreationIntentRunOptions,
): BranchCreationIntentRunResult {
  const intent = planBranchCreationIntent({
    prIntent: readJsonIfExists(options.prIntentPath),
    baseRef: options.baseRef,
    localRefs: options.localRefsPath ? readLocalRefs(options.localRefsPath) : undefined,
  });
  const outputRoot = resolve(options.outputRoot);
  const jsonPath = join(outputRoot, "branch-creation-intent.json");
  const markdownPath = join(outputRoot, "branch-creation-intent.md");
  const markdown = renderBranchCreationIntentMarkdown(intent);
  writeJson(jsonPath, intent);
  mkdirSync(dirname(markdownPath), { recursive: true });
  writeFileSync(markdownPath, markdown, "utf8");
  return { intent, markdown, jsonPath, markdownPath };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const prIntentPath = stringArg(args.pr_intent, "");
  const outputRoot = stringArg(args.output_root, "results/branch-creation-intent");
  const baseRef = stringArg(args.base_ref, "main");
  const localRefsPath = stringArg(args.local_refs, "");
  if (!prIntentPath) {
    console.error(
      "Usage: pnpm run branch-creation-intent -- --pr-intent <path> --output-root <path> --base-ref main",
    );
    process.exitCode = 1;
    return;
  }
  const result = runBranchCreationIntent({
    prIntentPath,
    outputRoot,
    baseRef,
    localRefsPath: localRefsPath || undefined,
  });
  console.log(`Branch creation intent JSON written: ${result.jsonPath}`);
  console.log(`Branch creation intent written: ${result.markdownPath}`);
  console.log(`Status: ${result.intent.status}`);
}

function readJsonIfExists(path: string): unknown {
  const resolved = resolve(path);
  if (!existsSync(resolved)) return undefined;
  return JSON.parse(readFileSync(resolved, "utf8")) as unknown;
}

function readLocalRefs(path: string): string[] {
  const resolved = resolve(path);
  if (!existsSync(resolved)) return [];
  const text = readFileSync(resolved, "utf8");
  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed))
      return parsed.filter((item): item is string => typeof item === "string");
    if (isObject(parsed) && Array.isArray(parsed.refs)) {
      return parsed.refs.filter((item): item is string => typeof item === "string");
    }
  } catch {
    // Fall through to newline parsing.
  }
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(sortStable(value), null, 2)}\n`, "utf8");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
