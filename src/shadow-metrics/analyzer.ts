import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import type { PolicyActionType } from "../policy-dsl/types.js";
import { sortStable } from "../stable-json.js";
import type { ShadowRuntimeMatch, ShadowRuntimeReport } from "../shadow-runtime/types.js";
import type {
  ShadowMetricsReport,
  ShadowMetricsRunResult,
  ShadowMetricsThresholds,
} from "./types.js";

export const DEFAULT_SHADOW_METRICS_THRESHOLDS: ShadowMetricsThresholds = {
  minObservations: 5,
  minAverageConfidence: 0.8,
  maxRiskCount: 1,
  highConfidenceThreshold: 0.8,
  lowConfidenceThreshold: 0.4,
  allowlistedActions: ["annotate_only", "propose_close"],
};

export function runShadowMetrics(options: {
  reportsDir: string;
  outputRoot?: string | undefined;
  generatedAt?: string | undefined;
  thresholds?: Partial<ShadowMetricsThresholds> | undefined;
}): ShadowMetricsRunResult {
  const warnings: string[] = [];
  try {
    const reportsDir = resolve(options.reportsDir);
    if (!existsSync(reportsDir)) {
      return { ok: false, warnings, error: `Missing shadow reports directory: ${reportsDir}` };
    }

    const reports = readReports(reportsDir, warnings);
    const generatedAt = options.generatedAt ?? new Date().toISOString();
    const report = analyzeShadowReports({
      reports,
      generatedAt,
      thresholds: options.thresholds,
    });
    const outputRoot = resolve(options.outputRoot ?? "results/shadow-metrics");
    const outputPath = join(outputRoot, `${fileSafeTimestamp(generatedAt)}.json`);

    mkdirSync(outputRoot, { recursive: true });
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

export function analyzeShadowReports(options: {
  reports: readonly ShadowRuntimeReport[];
  generatedAt: string;
  thresholds?: Partial<ShadowMetricsThresholds> | undefined;
}): ShadowMetricsReport {
  const thresholds = normalizeThresholds(options.thresholds);
  const matches = options.reports
    .flatMap((report) => report.matches)
    .filter(isShadowRuntimeMatch)
    .sort(compareMatches);
  const grouped = groupMatches(matches);
  const policies = [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([policyId, policyMatches]) => policyMetrics(policyId, policyMatches, thresholds));

  return {
    schema_version: 1,
    generated_at: options.generatedAt,
    policy_count: policies.length,
    total_matches: matches.length,
    matches_by_policy: Object.fromEntries(
      policies.map((policy) => [policy.policy_id, policy.matches_by_policy]),
    ),
    would_action_counts: actionCounts(matches),
    average_confidence_by_policy: Object.fromEntries(
      policies.map((policy) => [policy.policy_id, policy.average_confidence_by_policy]),
    ),
    blocked_count: matches.filter((match) => match.confidence_band === "blocked").length,
    risk_count_by_policy: Object.fromEntries(
      policies.map((policy) => [policy.policy_id, policy.risk_count_by_policy]),
    ),
    high_confidence_match_count: matches.filter(
      (match) => match.confidence_score >= thresholds.highConfidenceThreshold,
    ).length,
    low_confidence_match_count: matches.filter(
      (match) => match.confidence_score <= thresholds.lowConfidenceThreshold,
    ).length,
    thresholds,
    policies,
  };
}

function policyMetrics(
  policyId: string,
  matches: readonly ShadowRuntimeMatch[],
  thresholds: ShadowMetricsThresholds,
) {
  const matchCount = matches.length;
  const averageConfidence = round(
    matchCount === 0
      ? 0
      : matches.reduce((total, match) => total + boundedScore(match.confidence_score), 0) /
          matchCount,
  );
  const blockedCount = matches.filter((match) => match.confidence_band === "blocked").length;
  const riskCount = matches.reduce((total, match) => total + match.risks.length, 0);
  const highConfidenceCount = matches.filter(
    (match) => match.confidence_score >= thresholds.highConfidenceThreshold,
  ).length;
  const lowConfidenceCount = matches.filter(
    (match) => match.confidence_score <= thresholds.lowConfidenceThreshold,
  ).length;
  const actions = uniqueActions(matches);
  const guardedCandidateReason = candidateReason({
    actions,
    averageConfidence,
    blockedCount,
    matchCount,
    riskCount,
    thresholds,
  });

  return {
    policy_id: policyId,
    matches_by_policy: matchCount,
    would_action_counts: actionCounts(matches),
    average_confidence_by_policy: averageConfidence,
    blocked_count: blockedCount,
    risk_count_by_policy: riskCount,
    high_confidence_match_count: highConfidenceCount,
    low_confidence_match_count: lowConfidenceCount,
    candidate_for_guarded_execution:
      guardedCandidateReason === "meets conservative shadow criteria",
    candidate_reason: guardedCandidateReason,
  };
}

function candidateReason(options: {
  actions: readonly PolicyActionType[];
  averageConfidence: number;
  blockedCount: number;
  matchCount: number;
  riskCount: number;
  thresholds: ShadowMetricsThresholds;
}): string {
  if (options.matchCount < options.thresholds.minObservations) {
    return `insufficient observations: ${options.matchCount}/${options.thresholds.minObservations}`;
  }
  if (options.blockedCount > 0) return `blocked matches present: ${options.blockedCount}`;
  if (options.averageConfidence < options.thresholds.minAverageConfidence) {
    return `average confidence below threshold: ${options.averageConfidence}/${options.thresholds.minAverageConfidence}`;
  }
  if (options.riskCount > options.thresholds.maxRiskCount) {
    return `risk count above threshold: ${options.riskCount}/${options.thresholds.maxRiskCount}`;
  }
  const unsupported = options.actions.filter(
    (action) => !options.thresholds.allowlistedActions.includes(action),
  );
  if (unsupported.length > 0) {
    return `action not allowlisted for guarded execution: ${unsupported.sort().join(", ")}`;
  }
  return "meets conservative shadow criteria";
}

function readReports(reportsDir: string, warnings: string[]): ShadowRuntimeReport[] {
  const reports: ShadowRuntimeReport[] = [];
  for (const path of jsonFiles(reportsDir)) {
    try {
      const report = JSON.parse(readFileSync(path, "utf8")) as unknown;
      if (!isShadowRuntimeReport(report)) {
        warnings.push(`${path}: not a shadow runtime report`);
        continue;
      }
      reports.push(report);
    } catch (error) {
      warnings.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return reports;
}

function jsonFiles(root: string): string[] {
  return readdirSync(root, { recursive: true })
    .map((name) => join(root, String(name)))
    .filter((path) => statSync(path).isFile() && path.endsWith(".json"))
    .sort();
}

function isShadowRuntimeReport(value: unknown): value is ShadowRuntimeReport {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { schema_version?: unknown }).schema_version === 1 &&
    Array.isArray((value as { matches?: unknown }).matches)
  );
}

function isShadowRuntimeMatch(value: unknown): value is ShadowRuntimeMatch {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { policy_id?: unknown }).policy_id === "string" &&
    (value as { matched?: unknown }).matched === true &&
    typeof (value as { would_action?: unknown }).would_action === "string" &&
    (value as { dry_run_only?: unknown }).dry_run_only === true &&
    typeof (value as { confidence_score?: unknown }).confidence_score === "number" &&
    typeof (value as { confidence_band?: unknown }).confidence_band === "string" &&
    Array.isArray((value as { risks?: unknown }).risks)
  );
}

function groupMatches(matches: readonly ShadowRuntimeMatch[]): Map<string, ShadowRuntimeMatch[]> {
  const grouped = new Map<string, ShadowRuntimeMatch[]>();
  for (const match of matches) {
    const items = grouped.get(match.policy_id) ?? [];
    items.push(match);
    grouped.set(match.policy_id, items);
  }
  return grouped;
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

function uniqueActions(matches: readonly ShadowRuntimeMatch[]): PolicyActionType[] {
  return [...new Set(matches.map((match) => match.would_action))].sort();
}

function compareMatches(left: ShadowRuntimeMatch, right: ShadowRuntimeMatch): number {
  return (
    left.policy_id.localeCompare(right.policy_id) ||
    left.item_number - right.item_number ||
    left.would_action.localeCompare(right.would_action)
  );
}

function normalizeThresholds(
  thresholds: Partial<ShadowMetricsThresholds> | undefined,
): ShadowMetricsThresholds {
  return {
    ...DEFAULT_SHADOW_METRICS_THRESHOLDS,
    ...thresholds,
    allowlistedActions: [
      ...(thresholds?.allowlistedActions ?? DEFAULT_SHADOW_METRICS_THRESHOLDS.allowlistedActions),
    ].sort(),
  };
}

function boundedScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function fileSafeTimestamp(value: string): string {
  return value.replaceAll(":", "-").replaceAll(".", "-");
}
