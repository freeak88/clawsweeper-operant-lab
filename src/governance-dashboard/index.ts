#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs, stringArg } from "../clawsweeper-args.js";
import { sortStable } from "../stable-json.js";
import { collectGovernanceArtifacts } from "./collector.js";
import { renderGovernanceDashboardMarkdown, synthesizeGovernanceDashboard } from "./synthesizer.js";
import type { GovernanceDashboardRunOptions, GovernanceDashboardRunResult } from "./types.js";

export { collectGovernanceArtifacts } from "./collector.js";
export { renderGovernanceDashboardMarkdown, synthesizeGovernanceDashboard } from "./synthesizer.js";
export type * from "./types.js";

export function runGovernanceDashboard(
  options: GovernanceDashboardRunOptions,
): GovernanceDashboardRunResult {
  const collection = collectGovernanceArtifacts(options.inputRoot);
  const dashboard = synthesizeGovernanceDashboard({
    artifacts: collection.artifacts,
    generatedAt: options.generatedAt,
  });
  const outputRoot = resolve(options.outputRoot);
  const jsonPath = join(outputRoot, "governance-dashboard.json");
  const markdownPath = join(outputRoot, "governance-dashboard.md");
  const markdown = renderGovernanceDashboardMarkdown(dashboard);
  writeJson(jsonPath, dashboard);
  mkdirSync(dirname(markdownPath), { recursive: true });
  writeFileSync(markdownPath, markdown, "utf8");
  return { dashboard, markdown, jsonPath, markdownPath };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const inputRoot = stringArg(args.input_root, "results");
  const outputRoot = stringArg(args.output_root, "results/governance-dashboard");
  const generatedAt = stringArg(args.generated_at, "");
  const result = runGovernanceDashboard({
    inputRoot,
    outputRoot,
    generatedAt: generatedAt || undefined,
  });
  console.log(`Governance dashboard written: ${result.markdownPath}`);
  console.log(`Governance dashboard JSON: ${result.jsonPath}`);
  console.log(`Next safe action: ${result.dashboard.summary.next_safe_action}`);
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(sortStable(value), null, 2)}\n`, "utf8");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
