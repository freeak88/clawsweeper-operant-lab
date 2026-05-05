export type PolicyDslStatus = "approved";

export type PolicyConditionOperator =
  | "equals"
  | "not_equals"
  | "includes"
  | "not_includes"
  | "exists"
  | "not_exists"
  | "gte"
  | "lte";

export type PolicyActionType =
  | "propose_close"
  | "propose_repair"
  | "propose_automerge"
  | "annotate_only";

export interface PolicyCondition {
  field: string;
  op: PolicyConditionOperator;
  value?: string | number | boolean | undefined;
}

export interface PolicyAction {
  type: PolicyActionType;
  mode: "dry_run_only";
}

export interface PolicyDslRule {
  policy_id: string;
  status: PolicyDslStatus;
  conditions: PolicyCondition[];
  action: PolicyAction;
}

export interface PolicyEvaluationResult {
  policy_id: string;
  matched: boolean;
  would_action: PolicyActionType;
  dry_run_only: true;
  matched_conditions: string[];
  failed_conditions: string[];
  risks: string[];
}

export interface PolicyDryRunReport {
  policy_id: string;
  dry_run_only: true;
  evaluated_count: number;
  matched_count: number;
  results: PolicyEvaluationResult[];
}

export interface PolicyDryRunFileResult {
  ok: boolean;
  report?: PolicyDryRunReport | undefined;
  outputPath?: string | undefined;
  error?: string | undefined;
}
