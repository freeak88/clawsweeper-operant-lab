import type { ConfidenceScoreResult } from "../confidence-engine/types.js";
import type { ReviewMemoryPattern } from "../review-memory/types.js";
import type {
  ImprovementCategory,
  ImprovementLoopInput,
  ImprovementRiskLevel,
  OperationalWeakness,
  WeaknessType,
} from "./types.js";

const DEFAULT_MIN_PATTERN_OCCURRENCES = 3;

export function detectOperationalWeaknesses(input: ImprovementLoopInput): OperationalWeakness[] {
  const weaknesses: OperationalWeakness[] = [];
  const minOccurrences = Math.max(
    2,
    Math.floor(input.minPatternOccurrences ?? DEFAULT_MIN_PATTERN_OCCURRENCES),
  );

  const scheduler = input.scheduler;
  if (
    scheduler?.capacityReason?.toLowerCase().includes("saturated") &&
    nonNegative(scheduler.dueBacklog) >= Math.max(1, nonNegative(scheduler.plannedCapacity))
  ) {
    weaknesses.push(
      weakness({
        type: "saturated_backlog",
        category: "scheduler",
        severity: "medium",
        summary: "Due backlog is saturating planned review capacity.",
        signals: [
          `due backlog ${nonNegative(scheduler.dueBacklog)}`,
          `planned capacity ${nonNegative(scheduler.plannedCapacity)}`,
          `capacity reason ${scheduler.capacityReason}`,
        ],
        confidence: 0.82,
      }),
    );
  }

  if (nonNegative(scheduler?.failedShardCount) >= 2) {
    weaknesses.push(
      weakness({
        type: "failed_shards",
        category: "scheduler",
        severity: "high",
        summary: "Repeated shard failures should be investigated before capacity changes.",
        signals: [`failed shard count ${nonNegative(scheduler?.failedShardCount)}`],
        confidence: 0.86,
      }),
    );
  }

  if (input.adaptiveSchedulerRecommendation?.recommendation === "increase_capacity") {
    weaknesses.push(
      weakness({
        type: "adaptive_scheduler_recommendation",
        category: "scheduler",
        severity: "low",
        summary:
          "Adaptive scheduler recommends capacity increase, but runtime settings remain unchanged.",
        signals: input.adaptiveSchedulerRecommendation.reasons,
        confidence: input.adaptiveSchedulerRecommendation.confidence,
      }),
    );
  }

  if (input.staleReviewQueueCount && input.staleReviewQueueCount >= minOccurrences) {
    weaknesses.push(
      weakness({
        type: "stale_review_queue",
        category: "review",
        severity: "medium",
        summary: "Stale review queue count suggests review freshness needs operator attention.",
        signals: [`stale review queue count ${input.staleReviewQueueCount}`],
        confidence: 0.7,
      }),
    );
  }

  for (const pattern of input.reviewMemory?.patterns ?? []) {
    if (pattern.occurrences < minOccurrences) continue;
    if (pattern.pattern_type === "repair_marker") {
      weaknesses.push(
        patternWeakness({
          pattern,
          type: "repeated_repair_marker",
          category: "policy",
          severity: "low",
          summary: `Repair marker '${pattern.pattern_value}' repeats across durable records.`,
          confidence: 0.74,
        }),
      );
    }
    if (pattern.pattern_type === "conflict_type") {
      weaknesses.push(
        patternWeakness({
          pattern,
          type: "recurring_conflict_type",
          category: "repair",
          severity: "medium",
          summary: `Conflict type '${pattern.pattern_value}' recurs often enough for shadow policy review.`,
          confidence: 0.76,
        }),
      );
    }
  }

  for (const confidence of input.confidenceResults ?? []) {
    if (confidence.confidence_band !== "low" && confidence.confidence_band !== "blocked") continue;
    weaknesses.push(confidenceWeakness(confidence));
  }

  if ((input.policyRfcDrafts?.length ?? 0) >= minOccurrences) {
    weaknesses.push(
      weakness({
        type: "repeated_policy_rfc_draft",
        category: "policy",
        severity: "low",
        summary: "Repeated draft Policy RFCs suggest a promotion or rejection review is needed.",
        signals: [...(input.policyRfcDrafts ?? [])].sort(),
        confidence: 0.68,
      }),
    );
  }

  for (const routing of input.modelRoutingRecommendations ?? []) {
    if (routing.routing_tier !== "high-risk") continue;
    weaknesses.push(
      weakness({
        type: "model_routing_mismatch",
        category: "routing",
        severity: "medium",
        summary:
          "High-risk routing recommendation should be compared against confidence and review outcomes.",
        signals: routing.routing_reasons,
        confidence: 0.66,
      }),
    );
  }

  return weaknesses.sort(compareWeaknesses);
}

function patternWeakness(options: {
  pattern: ReviewMemoryPattern;
  type: WeaknessType;
  category: ImprovementCategory;
  severity: ImprovementRiskLevel;
  summary: string;
  confidence: number;
}): OperationalWeakness {
  return weakness({
    type: options.type,
    category: options.category,
    severity: options.severity,
    summary: options.summary,
    signals: [
      `${options.pattern.pattern_type}=${options.pattern.pattern_value}`,
      `occurrences ${options.pattern.occurrences}`,
      `distinct items ${options.pattern.distinct_items}`,
    ],
    confidence: options.confidence,
    sourcePatterns: [options.pattern],
  });
}

function confidenceWeakness(confidence: ConfidenceScoreResult): OperationalWeakness {
  return weakness({
    type: "low_confidence_pattern",
    category: "review",
    severity: confidence.confidence_band === "blocked" ? "high" : "medium",
    summary: `Confidence target '${confidence.confidence_target}' is ${confidence.confidence_band}.`,
    signals: [
      `confidence score ${confidence.confidence_score}`,
      `suggested action ${confidence.suggested_action}`,
      ...confidence.confidence_reasons,
      ...confidence.blocking_risks.map((risk) => `blocking risk ${risk}`),
    ],
    confidence: 1 - bounded(confidence.confidence_score),
  });
}

function weakness(options: {
  type: WeaknessType;
  category: ImprovementCategory;
  severity: ImprovementRiskLevel;
  summary: string;
  signals: readonly string[];
  confidence: number;
  sourcePatterns?: readonly ReviewMemoryPattern[] | undefined;
}): OperationalWeakness {
  return {
    weakness_id: `${options.type}-${hashText([options.summary, ...options.signals].join("|"))}`,
    weakness_type: options.type,
    category: options.category,
    severity: options.severity,
    summary: options.summary,
    observed_signals: sortedUnique(options.signals),
    confidence_score: round(bounded(options.confidence)),
    source_patterns: [...(options.sourcePatterns ?? [])].sort(comparePatterns),
  };
}

function compareWeaknesses(left: OperationalWeakness, right: OperationalWeakness): number {
  return (
    severityRank(right.severity) - severityRank(left.severity) ||
    left.category.localeCompare(right.category) ||
    left.weakness_type.localeCompare(right.weakness_type) ||
    left.weakness_id.localeCompare(right.weakness_id)
  );
}

function comparePatterns(left: ReviewMemoryPattern, right: ReviewMemoryPattern): number {
  return (
    left.pattern_type.localeCompare(right.pattern_type) ||
    left.pattern_value.localeCompare(right.pattern_value)
  );
}

function severityRank(value: ImprovementRiskLevel): number {
  return { low: 1, medium: 2, high: 3 }[value];
}

function nonNegative(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function bounded(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function hashText(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
