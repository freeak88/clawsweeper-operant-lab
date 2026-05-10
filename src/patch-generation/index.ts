#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs, stringArg } from "../clawsweeper-args.js";
import { sortStable } from "../stable-json.js";
import { generatePatchProposal, renderPatchProposalMarkdown } from "./generator.js";
import type { PatchGenerationRunOptions, PatchGenerationRunResult } from "./types.js";

export { generatePatchProposal, renderPatchProposalMarkdown } from "./generator.js";
export type * from "./types.js";

export function runPatchGeneration(options: PatchGenerationRunOptions): PatchGenerationRunResult {
  const proposal = generatePatchProposal({
    plan: readJsonIfExists(options.planPath),
    promptJson: options.promptJsonPath ? readJsonIfExists(options.promptJsonPath) : undefined,
    promptMarkdown: options.promptMarkdownPath
      ? readTextIfExists(options.promptMarkdownPath)
      : undefined,
  });
  const outputRoot = resolve(options.outputRoot);
  const jsonPath = join(outputRoot, "patch-proposal.json");
  const markdownPath = join(outputRoot, "patch-proposal.md");
  const markdown = renderPatchProposalMarkdown(proposal);
  writeJson(jsonPath, proposal);
  mkdirSync(dirname(markdownPath), { recursive: true });
  writeFileSync(markdownPath, markdown, "utf8");
  return { proposal, markdown, jsonPath, markdownPath };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const planPath = stringArg(args.plan, "");
  const outputRoot = stringArg(args.output_root, "results/patch-generation");
  const promptJsonPath = stringArg(args.prompt_json, "");
  const promptMarkdownPath = stringArg(args.prompt_markdown, "");
  if (!planPath) {
    console.error("Usage: pnpm run patch-generation -- --plan <path> --output-root <path>");
    process.exitCode = 1;
    return;
  }
  const result = runPatchGeneration({
    planPath,
    outputRoot,
    promptJsonPath: promptJsonPath || undefined,
    promptMarkdownPath: promptMarkdownPath || undefined,
  });
  console.log(`Patch proposal JSON written: ${result.jsonPath}`);
  console.log(`Patch proposal written: ${result.markdownPath}`);
  console.log(`Status: ${result.proposal.status}`);
}

function readJsonIfExists(path: string): unknown {
  const resolved = resolve(path);
  if (!existsSync(resolved)) return undefined;
  return JSON.parse(readFileSync(resolved, "utf8")) as unknown;
}

function readTextIfExists(path: string): string | undefined {
  const resolved = resolve(path);
  if (!existsSync(resolved)) return undefined;
  return readFileSync(resolved, "utf8");
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(sortStable(value), null, 2)}\n`, "utf8");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
