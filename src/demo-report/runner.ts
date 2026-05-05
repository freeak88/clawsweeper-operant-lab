import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import { dryRunPolicyDsl } from "../policy-dsl/index.js";
import type { PolicyCondition, PolicyDslRule } from "../policy-dsl/types.js";
import { runPolicyRfc } from "../policy-rfc/index.js";
import { buildReviewMemoryIndex } from "../review-memory/index.js";
import type { ReviewMemoryIndex, ReviewMemoryPattern } from "../review-memory/types.js";
import { sortStable } from "../stable-json.js";
import { analyzeShadowReports } from "../shadow-metrics/index.js";
import { buildShadowRuntimeReport } from "../shadow-runtime/index.js";
import { normalizeDemoRepoInput } from "./repo.js";
import { synthesizeDemoReportMarkdown } from "./synthesizer.js";
import type {
  DemoReportArtifacts,
  DemoReportJson,
  DemoReportOptions,
  DemoReportRunResult,
  DemoReportSafetyBoundary,
} from "./types.js";

export const DEMO_REPORT_SAFETY_BOUNDARY: DemoReportSafetyBoundary = {
  github_mutation: false,
  execution_enabled: false,
  guarded_execution: false,
  repair_dispatch: false,
  issue_close: false,
  pr_merge: false,
};

export function runDemoReport(options: DemoReportOptions): DemoReportRunResult {
  const repo = normalizeDemoRepoInput(options.repoInput);
  const generatedAt = normalizedGeneratedAt(options.generatedAt);
  const outputDir = resolve(options.outputRoot, repo.repo_slug);
  const artifactsDir = join(outputDir, "artifacts");
  const warnings: string[] = [];
  mkdirSync(artifactsDir, { recursive: true });

  const sourceRecords = localRecordCandidates(resolve(options.recordsRoot), repo.repo_slug);
  const selectedRecords = sourceRecords.slice(0, Math.max(0, options.maxRecords));
  const workingRecordsRoot = join(artifactsDir, "records-input");
  prepareRecordSnapshot({
    selectedRecords,
    sourceRecordsRoot: resolve(options.recordsRoot),
    targetRecordsRoot: workingRecordsRoot,
  });

  const artifacts: DemoReportArtifacts = {};
  let memory: ReviewMemoryIndex | undefined;
  let demoPolicy: PolicyDslRule | undefined;
  let policyRfcCount = 0;
  let shadowMatchCount = 0;
  let candidatePolicyCount = 0;

  if (selectedRecords.length > 0) {
    try {
      memory = buildReviewMemoryIndex({
        recordsRoot: workingRecordsRoot,
        policyRfcRoot: resolve(options.policyRfcRoot),
        targetRepo: repo.target_repo,
        generatedAt,
      });
      artifacts.review_memory = "artifacts/review-memory.json";
      writeJson(join(outputDir, artifacts.review_memory), memory);

      const policyRfcRoot = join(artifactsDir, "policy-rfc");
      const policyRfc = runPolicyRfc({
        recordsRoot: workingRecordsRoot,
        outputRoot: policyRfcRoot,
        targetRepo: repo.target_repo,
        minOccurrences: options.minOccurrences,
        createdAt: generatedAt,
      });
      policyRfcCount = policyRfc.proposals;
      artifacts.policy_rfc_dir = "artifacts/policy-rfc";

      demoPolicy = synthesizeDemoPolicy(memory, repo.repo_slug, options.minOccurrences);
      if (demoPolicy) {
        const policyDir = join(artifactsDir, "policy-dsl");
        const policyPath = join(policyDir, `${demoPolicy.policy_id}.json`);
        mkdirSync(policyDir, { recursive: true });
        writeJson(policyPath, demoPolicy);
        artifacts.policy_dsl_dir = "artifacts/policy-dsl";
        artifacts.policy_dsl = normalizePath(relative(outputDir, policyPath));

        const dryRun = dryRunPolicyDsl(demoPolicy, memory);
        const dryRunPath = join(policyDir, `${demoPolicy.policy_id}.dry-run.json`);
        writeJson(dryRunPath, dryRun);
        artifacts.policy_dsl_dry_run = normalizePath(relative(outputDir, dryRunPath));

        const shadowRuntime = buildShadowRuntimeReport({
          policies: [demoPolicy],
          memory,
          generatedAt,
        });
        const shadowRuntimePath = join(artifactsDir, "shadow-runtime.json");
        writeJson(shadowRuntimePath, shadowRuntime);
        artifacts.shadow_runtime = "artifacts/shadow-runtime.json";
        shadowMatchCount = shadowRuntime.summary.match_count;

        const shadowMetrics = analyzeShadowReports({
          reports: [shadowRuntime],
          generatedAt,
        });
        const shadowMetricsPath = join(artifactsDir, "shadow-metrics.json");
        writeJson(shadowMetricsPath, shadowMetrics);
        artifacts.shadow_metrics = "artifacts/shadow-metrics.json";
        candidatePolicyCount = shadowMetrics.policies.filter(
          (policy) => policy.candidate_for_guarded_execution,
        ).length;
      }
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : String(error));
    }
  }

  const report: DemoReportJson = {
    schema_version: 1,
    generated_at: generatedAt,
    target_repo: repo.target_repo,
    input: {
      repo_url: options.repoInput,
      record_count: selectedRecords.length,
    },
    summary: {
      pattern_count: memory?.summary.pattern_count ?? 0,
      policy_rfc_count: policyRfcCount,
      shadow_match_count: shadowMatchCount,
      candidate_policy_count: candidatePolicyCount,
      executed_count: 0,
    },
    decision: {
      executed: false,
      reason: "report-only demo generation",
    },
    safety_boundary: DEMO_REPORT_SAFETY_BOUNDARY,
    artifacts,
  };

  const markdown = synthesizeDemoReportMarkdown({ repo, report, warnings });
  const markdownPath = join(outputDir, "demo-report.md");
  const jsonPath = join(outputDir, "demo-report.json");
  writeFileSync(markdownPath, markdown, "utf8");
  writeJson(jsonPath, report);

  return {
    repo,
    outputDir,
    markdownPath,
    jsonPath,
    report,
    memory,
    demoPolicy,
    warnings,
  };
}

function synthesizeDemoPolicy(
  memory: ReviewMemoryIndex,
  repoSlug: string,
  minOccurrences: number,
): PolicyDslRule | undefined {
  const pattern = [...memory.patterns]
    .filter((candidate) => candidate.occurrences >= minOccurrences)
    .filter((candidate) =>
      ["label", "verdict", "repair_marker", "conflict_type"].includes(candidate.pattern_type),
    )
    .sort(comparePatterns)[0];
  if (!pattern) return undefined;

  return {
    policy_id: `demo-${repoSlug}-${pattern.pattern_type}-${slugify(pattern.pattern_value)}`,
    status: "approved",
    conditions: [conditionForPattern(pattern)],
    action: {
      type: "annotate_only",
      mode: "dry_run_only",
    },
  };
}

function conditionForPattern(pattern: ReviewMemoryPattern): PolicyCondition {
  const fieldByType: Record<string, string> = {
    label: "labels",
    verdict: "verdicts",
    repair_marker: "repair_markers",
    conflict_type: "conflict_types",
  };
  return {
    field: fieldByType[pattern.pattern_type] ?? pattern.pattern_type,
    op: "includes",
    value: pattern.pattern_value,
  };
}

function localRecordCandidates(recordsRoot: string, repoSlug: string): string[] {
  const repoRoot = join(recordsRoot, repoSlug);
  if (!existsSync(repoRoot) || !safeIsDirectory(repoRoot)) return [];
  return walkFiles(repoRoot)
    .filter((path) => path.endsWith(".md") || path.endsWith(".json"))
    .sort();
}

function prepareRecordSnapshot(options: {
  selectedRecords: readonly string[];
  sourceRecordsRoot: string;
  targetRecordsRoot: string;
}): void {
  rmSync(options.targetRecordsRoot, { recursive: true, force: true });
  for (const source of options.selectedRecords) {
    const target = join(options.targetRecordsRoot, relative(options.sourceRecordsRoot, source));
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
  }
}

function walkFiles(root: string): string[] {
  const files: string[] = [];
  for (const name of safeReadDir(root).sort()) {
    const fullPath = join(root, name);
    if (safeIsDirectory(fullPath)) files.push(...walkFiles(fullPath));
    else files.push(fullPath);
  }
  return files;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(sortStable(value), null, 2)}\n`, "utf8");
}

function safeReadDir(path: string): string[] {
  try {
    return readdirSync(path);
  } catch {
    return [];
  }
}

function safeIsDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function normalizedGeneratedAt(value: string | undefined): string {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toISOString();
}

function comparePatterns(left: ReviewMemoryPattern, right: ReviewMemoryPattern): number {
  return (
    left.pattern_type.localeCompare(right.pattern_type) ||
    right.occurrences - left.occurrences ||
    left.pattern_value.localeCompare(right.pattern_value)
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizePath(path: string): string {
  return path.split(sep).join("/");
}
