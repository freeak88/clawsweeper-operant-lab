import type {
  AdaptiveSchedulerInput,
  AdaptiveSchedulerRecommendation,
} from "../adaptive-scheduler/types.js";
import type { ConfidenceScoreResult } from "../confidence-engine/types.js";
import type { ModelRoutingRecommendation } from "../model-routing/types.js";
import type { ReviewMemoryIndex, ReviewMemoryPattern } from "../review-memory/types.js";

export type ImprovementCategory =
  | "scheduler"
  | "routing"
  | "policy"
  | "memory"
  | "review"
  | "repair";
export type ImprovementRiskLevel = "low" | "medium" | "high";
export type WeaknessType =
  | "saturated_backlog"
  | "failed_shards"
  | "repeated_repair_marker"
  | "low_confidence_pattern"
  | "recurring_conflict_type"
  | "stale_review_queue"
  | "repeated_policy_rfc_draft"
  | "model_routing_mismatch"
  | "adaptive_scheduler_recommendation";

export interface ImprovementLoopInput {
  targetRepo: string;
  generatedAt?: string | undefined;
  scheduler?: AdaptiveSchedulerInput | undefined;
  adaptiveSchedulerRecommendation?: AdaptiveSchedulerRecommendation | undefined;
  reviewMemory?: ReviewMemoryIndex | undefined;
  confidenceResults?: readonly ConfidenceScoreResult[] | undefined;
  modelRoutingRecommendations?: readonly ModelRoutingRecommendation[] | undefined;
  policyRfcDrafts?: readonly string[] | undefined;
  staleReviewQueueCount?: number | undefined;
  minPatternOccurrences?: number | undefined;
}

export interface OperationalWeakness {
  weakness_id: string;
  weakness_type: WeaknessType;
  category: ImprovementCategory;
  severity: ImprovementRiskLevel;
  summary: string;
  observed_signals: string[];
  confidence_score: number;
  source_patterns: ReviewMemoryPattern[];
}

export interface ImprovementProposal {
  proposal_id: string;
  category: ImprovementCategory;
  problem_summary: string;
  observed_signals: string[];
  proposed_change: string;
  expected_benefit: string;
  risk_level: ImprovementRiskLevel;
  confidence_score: number;
}

export interface ImprovementSimulation {
  proposal_id: string;
  estimated_backlog_reduction: number;
  estimated_shard_utilization_change: number;
  estimated_confidence_improvement: number;
  estimated_repair_reduction: number;
  simulation_notes: string[];
}

export interface GuardedPrSuggestion {
  proposal_id: string;
  title: string;
  summary: string;
  safety_notes: string[];
  affected_systems: ImprovementCategory[];
}

export interface ImprovementLoopReport {
  schema_version: 1;
  generated_at: string;
  target_repo: string;
  summary: {
    weakness_count: number;
    proposal_count: number;
    simulation_count: number;
    pr_suggestion_count: number;
    executed_count: 0;
  };
  weaknesses: OperationalWeakness[];
  proposals: ImprovementProposal[];
  simulations: ImprovementSimulation[];
  pr_suggestions: GuardedPrSuggestion[];
  safety_boundary: {
    github_mutation: false;
    scheduler_mutation: false;
    apply_automerge_mutation: false;
    repair_dispatch: false;
    autonomous_merge: false;
    runtime_self_modification: false;
  };
}

export interface ImprovementLoopRunOptions {
  input: ImprovementLoopInput;
  outputRoot: string;
  generatedAt?: string | undefined;
}

export interface ImprovementLoopRunResult {
  report: ImprovementLoopReport;
  outputDir: string;
  jsonPath: string;
  markdownPath: string;
}
