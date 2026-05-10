import type { IsolatedPatchApplicationJson } from "../isolated-patch-application/types.js";
import type { LocalValidationResultJson } from "../local-validation-runner/types.js";
import type { PatchProposalJson } from "../patch-generation/types.js";

export type CommitIntentStatus = "ready" | "blocked" | "needs_review";
export type CommitIntentNextStep = "manual_commit_review" | "stop" | "request_human_review";

export interface CommitIntentJson {
  commit_intent_id: string;
  patch_id: string;
  status: CommitIntentStatus;
  proposed_commit_message: string;
  files_expected: string[];
  validation_evidence: string[];
  rollback_note: string;
  recommended_next_step: CommitIntentNextStep;
  blocked_reason: string | null;
}

export interface CommitIntentPlannerOptions {
  validation: LocalValidationResultJson | Record<string, unknown> | unknown;
  application: IsolatedPatchApplicationJson | Record<string, unknown> | unknown;
  patch: PatchProposalJson | Record<string, unknown> | unknown;
}

export interface CommitIntentRunOptions {
  validationPath: string;
  applicationPath: string;
  patchPath: string;
  outputRoot: string;
}

export interface CommitIntentRunResult {
  intent: CommitIntentJson;
  markdown: string;
  jsonPath: string;
  markdownPath: string;
}
