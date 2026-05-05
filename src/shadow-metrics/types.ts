import type { PolicyActionType } from "../policy-dsl/types.js";

export interface ShadowMetricsThresholds {
  minObservations: number;
  minAverageConfidence: number;
  maxRiskCount: number;
  highConfidenceThreshold: number;
  lowConfidenceThreshold: number;
  allowlistedActions: PolicyActionType[];
}

export interface ShadowPolicyMetrics {
  policy_id: string;
  matches_by_policy: number;
  would_action_counts: Partial<Record<PolicyActionType, number>>;
  average_confidence_by_policy: number;
  blocked_count: number;
  risk_count_by_policy: number;
  high_confidence_match_count: number;
  low_confidence_match_count: number;
  candidate_for_guarded_execution: boolean;
  candidate_reason: string;
}

export interface ShadowMetricsReport {
  schema_version: 1;
  generated_at: string;
  policy_count: number;
  total_matches: number;
  matches_by_policy: Record<string, number>;
  would_action_counts: Partial<Record<PolicyActionType, number>>;
  average_confidence_by_policy: Record<string, number>;
  blocked_count: number;
  risk_count_by_policy: Record<string, number>;
  high_confidence_match_count: number;
  low_confidence_match_count: number;
  thresholds: ShadowMetricsThresholds;
  policies: ShadowPolicyMetrics[];
}

export interface ShadowMetricsRunResult {
  ok: boolean;
  report?: ShadowMetricsReport | undefined;
  outputPath?: string | undefined;
  warnings: string[];
  error?: string | undefined;
}
