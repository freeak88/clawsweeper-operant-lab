import type { ConfidenceBand } from "../confidence-engine/types.js";
import type { PolicyActionType } from "../policy-dsl/types.js";

export interface ShadowRuntimeMatch {
  policy_id: string;
  item_number: number;
  matched: true;
  would_action: PolicyActionType;
  dry_run_only: true;
  confidence_score: number;
  confidence_band: ConfidenceBand;
  risks: string[];
}

export interface ShadowRuntimeReport {
  schema_version: 1;
  generated_at: string;
  target_repo: string;
  summary: {
    policy_count: number;
    item_count: number;
    match_count: number;
    would_action_counts: Partial<Record<PolicyActionType, number>>;
  };
  matches: ShadowRuntimeMatch[];
}

export interface ShadowRuntimeRunResult {
  ok: boolean;
  report?: ShadowRuntimeReport | undefined;
  outputPath?: string | undefined;
  warnings: string[];
  error?: string | undefined;
}
