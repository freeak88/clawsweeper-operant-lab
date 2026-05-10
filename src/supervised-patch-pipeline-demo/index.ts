#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs, stringArg } from "../clawsweeper-args.js";
import { sortStable } from "../stable-json.js";
import {
  buildSupervisedPatchPipelineDemo,
  renderSupervisedPatchPipelineDemoMarkdown,
} from "./runner.js";
import type {
  SupervisedPatchPipelineDemoRunOptions,
  SupervisedPatchPipelineDemoRunResult,
  SupervisedPatchPipelineDemoScenario,
} from "./types.js";

export {
  buildSupervisedPatchPipelineDemo,
  renderSupervisedPatchPipelineDemoMarkdown,
} from "./runner.js";
export type * from "./types.js";

export function runSupervisedPatchPipelineDemo(
  options: SupervisedPatchPipelineDemoRunOptions,
): SupervisedPatchPipelineDemoRunResult {
  const report = buildSupervisedPatchPipelineDemo({
    scenario: options.scenario,
    generatedAt: options.generatedAt,
  });
  const outputRoot = resolve(options.outputRoot);
  const jsonPath = join(outputRoot, "supervised-patch-pipeline-demo.json");
  const markdownPath = join(outputRoot, "supervised-patch-pipeline-demo.md");
  const markdown = renderSupervisedPatchPipelineDemoMarkdown(report);
  writeJson(jsonPath, report);
  mkdirSync(dirname(markdownPath), { recursive: true });
  writeFileSync(markdownPath, markdown, "utf8");
  return { report, markdown, jsonPath, markdownPath };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const outputRoot = stringArg(args.output_root, "results/supervised-patch-pipeline-demo");
  const scenario = parseScenario(stringArg(args.scenario, "happy_path"));
  const generatedAt = stringArg(args.generated_at, "");
  const result = runSupervisedPatchPipelineDemo({
    outputRoot,
    scenario,
    generatedAt: generatedAt || undefined,
  });
  console.log(`Supervised patch pipeline demo written: ${result.markdownPath}`);
  console.log(`Supervised patch pipeline demo JSON: ${result.jsonPath}`);
  console.log(`Final status: ${result.report.summary.final_status}`);
}

function parseScenario(value: string): SupervisedPatchPipelineDemoScenario {
  if (
    value === "happy_path" ||
    value === "blocked_approval" ||
    value === "needs_review_validation"
  ) {
    return value;
  }
  return "happy_path";
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(sortStable(value), null, 2)}\n`, "utf8");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
