import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { scoreConfidence } from "../confidence-engine/index.js";
import type { ConfidenceTarget } from "../confidence-engine/types.js";
import { evaluatePolicyDsl, parsePolicyDsl } from "../policy-dsl/index.js";
import type { PolicyActionType, PolicyDslRule } from "../policy-dsl/types.js";
import { repositoryProfileFor } from "../repository-profiles.js";
import type { ReviewMemoryIndex, ReviewMemoryItem } from "../review-memory/types.js";
import { sortStable } from "../stable-json.js";
import type { ShadowRuntimeMatch, ShadowRuntimeReport, ShadowRuntimeRunResult } from "./types.js";

export function runShadowRuntime(options: {
  policiesDir: string;
  memoryPath: string;
  outputRoot?: string | undefined;
  generatedAt?: string | undefined;
}): ShadowRuntimeRunResult {
  const warnings: string[] = [];
  try {
    const policiesDir = resolve(options.policiesDir);
    const memoryPath = resolve(options.memoryPath);
    if (!existsSync(policiesDir)) {
      return { ok: false, warnings, error: `Missing policies directory: ${policiesDir}` };
    }
    if (!existsSync(memoryPath)) {
      return { ok: false, warnings, error: `Missing memory file: ${memoryPath}` };
    }

    const memory = readJson(memoryPath) as ReviewMemoryIndex;
    if (!isReviewMemoryIndex(memory)) {
      return {
        ok: false,
        warnings,
        error: "Shadow runtime memory input must be a review-memory index",
      };
    }

    const policies = readPolicies(policiesDir, warnings);
    const generatedAt = options.generatedAt ?? new Date().toISOString();
    const report = buildShadowRuntimeReport({
      policies,
      memory,
      generatedAt,
    });
    const profile = repositoryProfileFor(memory.target_repo);
    const outputRoot = resolve(options.outputRoot ?? "results/shadow-runtime");
    const outputDir = join(outputRoot, profile.slug);
    const outputPath = join(outputDir, `${fileSafeTimestamp(generatedAt)}.json`);

    mkdirSync(outputDir, { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(sortStable(report), null, 2)}\n`);
    return { ok: true, report, outputPath, warnings };
  } catch (error) {
    return {
      ok: false,
      warnings,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function buildShadowRuntimeReport(options: {
  policies: readonly PolicyDslRule[];
  memory: ReviewMemoryIndex;
  generatedAt: string;
}): ShadowRuntimeReport {
  const matches: ShadowRuntimeMatch[] = [];
  const items = [...options.memory.items].sort(
    (left, right) => left.item_number - right.item_number,
  );
  const policies = [...options.policies].sort((left, right) =>
    left.policy_id.localeCompare(right.policy_id),
  );

  for (const policy of policies) {
    for (const item of items) {
      const evaluation = evaluatePolicyDsl(policy, item);
      if (!evaluation.matched) continue;
      const confidence = confidenceFor(policy.action.type, item);
      matches.push({
        policy_id: policy.policy_id,
        item_number: item.item_number,
        matched: true,
        would_action: evaluation.would_action,
        dry_run_only: true,
        confidence_score: confidence.confidence_score,
        confidence_band: confidence.confidence_band,
        risks: [...evaluation.risks, ...confidence.blocking_risks].sort(),
      });
    }
  }

  matches.sort(compareMatches);
  return {
    schema_version: 1,
    generated_at: options.generatedAt,
    target_repo: options.memory.target_repo,
    summary: {
      policy_count: policies.length,
      item_count: items.length,
      match_count: matches.length,
      would_action_counts: actionCounts(matches),
    },
    matches,
  };
}

function readPolicies(policiesDir: string, warnings: string[]): PolicyDslRule[] {
  const policies: PolicyDslRule[] = [];
  for (const path of jsonFiles(policiesDir)) {
    try {
      policies.push(parsePolicyDsl(readJson(path)));
    } catch (error) {
      warnings.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return policies;
}

function jsonFiles(root: string): string[] {
  return readdirSync(root)
    .map((name) => join(root, name))
    .filter((path) => statSync(path).isFile() && path.endsWith(".json"))
    .sort();
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function isReviewMemoryIndex(value: unknown): value is ReviewMemoryIndex {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { schema_version?: unknown }).schema_version === 1 &&
    typeof (value as { target_repo?: unknown }).target_repo === "string" &&
    Array.isArray((value as { items?: unknown }).items)
  );
}

function confidenceFor(actionType: PolicyActionType, item: ReviewMemoryItem) {
  return scoreConfidence({
    confidenceTarget: confidenceTargetForAction(actionType),
    reviewVerdict: item.verdicts[0],
    labels: item.labels,
    repairMarkers: item.repair_markers,
    conflictTypes: item.conflict_types,
    safeCloseReason: item.safe_close_reasons[0],
    reviewMemoryPatterns: [
      ...item.verdicts,
      ...item.repair_markers,
      ...item.conflict_types,
      ...item.safe_close_reasons,
      ...item.automerge_causes,
    ],
    policyRfcMatches: item.policy_rfc_refs,
  });
}

function confidenceTargetForAction(actionType: PolicyActionType): ConfidenceTarget {
  switch (actionType) {
    case "propose_close":
      return "safe_close";
    case "propose_repair":
      return "repair_acceptance";
    case "propose_automerge":
      return "automerge_readiness";
    case "annotate_only":
      return "review_verdict";
  }
}

function actionCounts(
  matches: readonly ShadowRuntimeMatch[],
): Partial<Record<PolicyActionType, number>> {
  const counts: Partial<Record<PolicyActionType, number>> = {};
  for (const match of matches) counts[match.would_action] = (counts[match.would_action] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort()) as Partial<
    Record<PolicyActionType, number>
  >;
}

function compareMatches(left: ShadowRuntimeMatch, right: ShadowRuntimeMatch): number {
  return (
    left.policy_id.localeCompare(right.policy_id) ||
    left.item_number - right.item_number ||
    left.would_action.localeCompare(right.would_action)
  );
}

function fileSafeTimestamp(value: string): string {
  return value.replaceAll(":", "-").replaceAll(".", "-");
}
