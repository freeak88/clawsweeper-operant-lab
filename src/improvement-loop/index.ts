#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs, stringArg } from "../clawsweeper-args.js";
import { sortStable } from "../stable-json.js";
import { detectOperationalWeaknesses } from "./detector.js";
import { guardedPrSuggestionsFor, planImprovementProposals } from "./planner.js";
import { simulateImprovementProposals } from "./simulator.js";
import type {
  ImprovementLoopInput,
  ImprovementLoopReport,
  ImprovementLoopRunOptions,
  ImprovementLoopRunResult,
} from "./types.js";

export { detectOperationalWeaknesses } from "./detector.js";
export { guardedPrSuggestionsFor, planImprovementProposals } from "./planner.js";
export { simulateImprovementProposals } from "./simulator.js";
export type * from "./types.js";

export function runImprovementLoop(options: ImprovementLoopRunOptions): ImprovementLoopRunResult {
  const generatedAt = normalizedGeneratedAt(options.generatedAt ?? options.input.generatedAt);
  const targetRepo = options.input.targetRepo || "unknown/unknown";
  const outputDir = join(resolve(options.outputRoot), repoSlug(targetRepo));
  const weaknesses = detectOperationalWeaknesses(options.input);
  const proposals = planImprovementProposals(weaknesses);
  const simulations = simulateImprovementProposals(proposals);
  const prSuggestions = guardedPrSuggestionsFor(proposals);
  const report: ImprovementLoopReport = {
    schema_version: 1,
    generated_at: generatedAt,
    target_repo: targetRepo,
    summary: {
      weakness_count: weaknesses.length,
      proposal_count: proposals.length,
      simulation_count: simulations.length,
      pr_suggestion_count: prSuggestions.length,
      executed_count: 0,
    },
    weaknesses,
    proposals,
    simulations,
    pr_suggestions: prSuggestions,
    safety_boundary: {
      github_mutation: false,
      scheduler_mutation: false,
      apply_automerge_mutation: false,
      repair_dispatch: false,
      autonomous_merge: false,
      runtime_self_modification: false,
    },
  };
  const jsonPath = join(outputDir, "improvement-loop.json");
  const markdownPath = join(outputDir, "improvement-loop.md");
  writeJson(jsonPath, report);
  writeFileSync(markdownPath, synthesizeMarkdown(report), "utf8");
  return { report, outputDir, jsonPath, markdownPath };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = stringArg(args.input, "");
  const outputRoot = stringArg(args.output_root, "results/improvement-loop");
  const generatedAt = typeof args.generated_at === "string" ? args.generated_at : undefined;
  if (!inputPath) {
    console.error("Usage: pnpm run improvement-loop -- --input <signals.json>");
    process.exitCode = 1;
    return;
  }
  if (!existsSync(inputPath)) {
    console.error(`Missing improvement-loop input: ${inputPath}`);
    process.exitCode = 1;
    return;
  }
  const input = JSON.parse(readFileSync(inputPath, "utf8")) as ImprovementLoopInput;
  const result = runImprovementLoop({ input, outputRoot, generatedAt });
  console.log(`Improvement loop report written: ${result.markdownPath}`);
  console.log(`Improvement loop JSON written: ${result.jsonPath}`);
  console.log(
    `Weaknesses: ${result.report.summary.weakness_count}; proposals: ${result.report.summary.proposal_count}; executions: ${result.report.summary.executed_count}`,
  );
}

function synthesizeMarkdown(report: ImprovementLoopReport): string {
  return [
    "# ClawSweeper Operant Lab Improvement Loop",
    "",
    "> Proposal-first, shadow-only improvement report. No GitHub mutation, autonomous merge, scheduler mutation, repair dispatch, or runtime self-modification occurred.",
    "",
    "## Summary",
    "",
    `- Repository: \`${report.target_repo}\``,
    `- Weaknesses detected: ${report.summary.weakness_count}`,
    `- Improvement proposals: ${report.summary.proposal_count}`,
    `- Shadow simulations: ${report.summary.simulation_count}`,
    `- Guarded PR suggestions: ${report.summary.pr_suggestion_count}`,
    `- Executions: ${report.summary.executed_count}`,
    "",
    "## Improvement Proposals",
    "",
    ...report.proposals.flatMap((proposal) => [
      `### ${proposal.proposal_id}`,
      "",
      `- Category: \`${proposal.category}\``,
      `- Risk: \`${proposal.risk_level}\``,
      `- Confidence: \`${proposal.confidence_score}\``,
      `- Problem: ${proposal.problem_summary}`,
      `- Proposed change: ${proposal.proposed_change}`,
      `- Expected benefit: ${proposal.expected_benefit}`,
      "",
    ]),
    "## Safety Boundary",
    "",
    "- No GitHub mutation.",
    "- No autonomous merge.",
    "- No scheduler/apply/automerge behavior change.",
    "- No repair dispatch.",
    "- No runtime self-modification.",
    "",
  ].join("\n");
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(sortStable(value), null, 2)}\n`, "utf8");
}

function repoSlug(targetRepo: string): string {
  return targetRepo.toLowerCase().replace(/[^a-z0-9_.-]+/g, "-");
}

function normalizedGeneratedAt(value: string | undefined): string {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toISOString();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
