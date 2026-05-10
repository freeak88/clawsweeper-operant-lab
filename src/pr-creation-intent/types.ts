import type { PatchProposalJson } from "../patch-generation/types.js";
import type { PatchValidationJson } from "../patch-validation/types.js";
import type { ShadowPatchExecutionJson } from "../shadow-patch-execution/types.js";

export type PrCreationIntentStatus = "ready" | "blocked" | "needs_review";
export type PrCreationIntentNextStep =
  | "stop"
  | "request_human_review"
  | "ready_for_manual_pr_creation";

export interface PrCreationApprovalJson {
  patch_id: string;
  approved: boolean;
  approved_by: string;
  approved_at: string;
  approval_scope: "pr_creation_intent_only" | string;
  notes: string;
}

export interface PrCreationIntentJson {
  intent_id: string;
  patch_id: string;
  status: PrCreationIntentStatus;
  branch_name: string;
  pr_title: string;
  pr_body: string;
  files_expected: string[];
  tests_required: string[];
  safety_constraints: string[];
  operator_approval: PrCreationApprovalJson | Record<string, never>;
  recommended_next_step: PrCreationIntentNextStep;
  blocked_reason: string | null;
}

export interface PrCreationIntentRunOptions {
  patchPath: string;
  validationPath: string;
  shadowPath: string;
  approvalPath: string;
  outputRoot: string;
}

export interface PrCreationIntentRunResult {
  intent: PrCreationIntentJson;
  markdown: string;
  jsonPath: string;
  markdownPath: string;
}

export type PrCreationIntentPatchInput = PatchProposalJson | Record<string, unknown>;
export type PrCreationIntentValidationInput = PatchValidationJson | Record<string, unknown>;
export type PrCreationIntentShadowInput = ShadowPatchExecutionJson | Record<string, unknown>;
export type PrCreationIntentApprovalInput = PrCreationApprovalJson | Record<string, unknown>;
