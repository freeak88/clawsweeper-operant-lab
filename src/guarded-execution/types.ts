export type GuardedExecutionAction = "annotate_only" | "suggest_comment";

export interface GuardedPolicyInput {
  policy_id: string;
  status: "approved";
  action: {
    type: string;
    mode?: string | undefined;
  };
}

export interface GuardedPolicyMetricsInput {
  policy_id: string;
  candidate_for_guarded_execution: boolean;
  blocked_count: number;
  risk_count_by_policy: number;
  candidate_reason?: string | undefined;
}

export interface GuardedConfidenceInput {
  confidence_score: number;
  confidence_band?: string | undefined;
  confidence_reasons?: string[] | undefined;
  blocking_risks?: string[] | undefined;
}

export interface GuardedExecutionInput {
  policy: GuardedPolicyInput;
  metrics: GuardedPolicyMetricsInput;
  confidence: GuardedConfidenceInput;
  item_number: number;
  dry_run: boolean;
  enabled?: boolean | undefined;
  generated_at?: string | undefined;
}

export interface GuardedExecutionDecision {
  schema_version: 1;
  generated_at: string;
  executed: boolean;
  dry_run: boolean;
  action: GuardedExecutionAction | "none";
  reason: string;
  policy_id: string;
  item_number: number;
  full_reasoning: string[];
  rollback_hint: string;
  safety_constraints: string[];
}

export interface GuardedExecutionRunResult {
  ok: boolean;
  decision?: GuardedExecutionDecision | undefined;
  outputPath?: string | undefined;
  error?: string | undefined;
}
