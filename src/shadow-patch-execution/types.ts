import type { PatchProposalJson } from "../patch-generation/types.js";
import type { PatchValidationJson } from "../patch-validation/types.js";

export type ShadowPatchExecutionStatus = "simulated" | "blocked" | "needs_review";
export type ShadowPatchExecutionNextStep =
  | "stop"
  | "request_human_review"
  | "eligible_for_operator_pr_creation";

export interface ShadowPatchSimulatedChange {
  kind: "intended_change" | "modify" | "add";
  value: string;
  applied: false;
}

export interface ShadowPatchSimulatedTest {
  command: string;
  executed: false;
}

export interface ShadowPatchExecutionJson {
  shadow_execution_id: string;
  patch_id: string;
  status: ShadowPatchExecutionStatus;
  simulated_changes: ShadowPatchSimulatedChange[];
  simulated_tests: ShadowPatchSimulatedTest[];
  risk_notes: string[];
  recommended_next_step: ShadowPatchExecutionNextStep;
  summary: string;
}

export interface ShadowPatchExecutionRunOptions {
  patchPath: string;
  validationPath: string;
  outputRoot: string;
}

export interface ShadowPatchExecutionRunResult {
  execution: ShadowPatchExecutionJson;
  markdown: string;
  jsonPath: string;
  markdownPath: string;
}

export type ShadowPatchProposalInput = PatchProposalJson | Record<string, unknown>;
export type ShadowPatchValidationInput = PatchValidationJson | Record<string, unknown>;
