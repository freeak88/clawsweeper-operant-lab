import type {
  GuardedPrSuggestion,
  ImprovementProposal,
  ImprovementSimulation,
} from "../improvement-loop/types.js";

export interface OperatorApprovalRecord {
  proposal_id: string;
  approved: boolean;
  approved_by: string;
  approved_at: string;
  approval_scope: "implementation_plan_only";
  notes: string;
}

export interface ApprovedImplementationPlan {
  plan_id: string;
  proposal_id: string;
  status: "approved_for_planning";
  approved_by: string;
  approved_at: string;
  approval_scope: "implementation_plan_only";
  implementation_steps: string[];
  files_likely_changed: string[];
  tests_required: string[];
  rollback_plan: string[];
  safety_constraints: string[];
  source_proposal: ImprovementProposal;
  source_simulation?: ImprovementSimulation | undefined;
  source_pr_suggestion?: GuardedPrSuggestion | undefined;
}

export interface BlockedApprovalGateOutput {
  plan_id: string;
  proposal_id: string;
  status: "blocked";
  blocked_reason: string;
  safety_constraints: string[];
}

export type ApprovalGateOutput = ApprovedImplementationPlan | BlockedApprovalGateOutput;

export interface ApprovalGateRunOptions {
  proposalPath: string;
  approvalPath?: string | undefined;
  simulationPath?: string | undefined;
  suggestionPath?: string | undefined;
  outputRoot: string;
}

export interface ApprovalGateRunResult {
  output: ApprovalGateOutput;
  outputPath: string;
}
