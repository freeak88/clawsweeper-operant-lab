import type { ApprovalGateOutput } from "../approval-gate/types.js";
import type { PatchProposalJson } from "../patch-generation/types.js";
import type { PatchValidationJson } from "../patch-validation/types.js";
import type { PrCreationIntentJson } from "../pr-creation-intent/types.js";
import type { ShadowPatchExecutionJson } from "../shadow-patch-execution/types.js";

export type SupervisedPatchPipelineDemoScenario =
  | "happy_path"
  | "blocked_approval"
  | "needs_review_validation";

export interface SupervisedPatchPipelineDemoReport {
  schema_version: 1;
  generated_at: string;
  scenario: SupervisedPatchPipelineDemoScenario;
  summary: {
    final_status: "ready" | "blocked" | "needs_review";
    approval_status: "approved_for_planning" | "blocked";
    patch_status: "patch_proposed" | "blocked";
    validation_status: "valid" | "blocked" | "needs_review";
    shadow_status: "simulated" | "blocked" | "needs_review";
    pr_intent_status: "ready" | "blocked" | "needs_review";
    executed_count: 0;
  };
  artifacts: {
    approval_gate: ApprovalGateOutput;
    patch_proposal: PatchProposalJson;
    patch_validation: PatchValidationJson;
    shadow_patch_execution: ShadowPatchExecutionJson;
    pr_creation_intent: PrCreationIntentJson;
  };
  safety_boundary: {
    github_mutation: false;
    branch_creation: false;
    commit_creation: false;
    push: false;
    pr_creation: false;
    patch_application: false;
    source_mutation: false;
    scheduler_apply_automerge_change: false;
  };
}

export interface SupervisedPatchPipelineDemoRunOptions {
  outputRoot: string;
  scenario?: SupervisedPatchPipelineDemoScenario | undefined;
  generatedAt?: string | undefined;
}

export interface SupervisedPatchPipelineDemoRunResult {
  report: SupervisedPatchPipelineDemoReport;
  markdown: string;
  jsonPath: string;
  markdownPath: string;
}
