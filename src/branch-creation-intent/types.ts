import type { PrCreationIntentJson } from "../pr-creation-intent/types.js";

export type BranchCreationIntentStatus = "ready" | "blocked" | "needs_review";
export type BranchCreationIntentNextStep =
  | "manual_branch_creation_review"
  | "stop"
  | "request_human_review";

export interface BranchCreationSafetyCheck {
  check: string;
  passed: boolean;
  message: string;
}

export interface BranchCreationIntentJson {
  branch_intent_id: string;
  status: BranchCreationIntentStatus;
  base_ref: string;
  proposed_branch_name: string;
  source_pr_intent: string;
  safety_checks: BranchCreationSafetyCheck[];
  rollback_note: string;
  recommended_next_step: BranchCreationIntentNextStep;
  blocked_reason: string | null;
}

export interface BranchCreationIntentRunOptions {
  prIntentPath: string;
  outputRoot: string;
  baseRef: string;
  localRefsPath?: string | undefined;
}

export interface BranchCreationIntentRunResult {
  intent: BranchCreationIntentJson;
  markdown: string;
  jsonPath: string;
  markdownPath: string;
}

export type BranchCreationPrIntentInput = PrCreationIntentJson | Record<string, unknown>;
