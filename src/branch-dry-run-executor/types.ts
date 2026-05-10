import type { BranchCreationIntentJson } from "../branch-creation-intent/types.js";

export type BranchDryRunExecutorStatus = "ready" | "blocked" | "needs_review";
export type BranchDryRunExecutorNextStep =
  | "operator_execution_review"
  | "stop"
  | "request_human_review";

export interface BranchDryRunSafetyCheck {
  check: string;
  passed: boolean;
  message: string;
}

export interface BranchDryRunExecutorJson {
  execution_preview_id: string;
  branch_intent_id: string;
  status: BranchDryRunExecutorStatus;
  allowed_command_preview: string;
  would_execute: false;
  safety_checks: BranchDryRunSafetyCheck[];
  recommended_next_step: BranchDryRunExecutorNextStep;
  blocked_reason: string | null;
}

export interface BranchDryRunExecutorRunOptions {
  branchIntentPath: string;
  outputRoot: string;
}

export interface BranchDryRunExecutorRunResult {
  preview: BranchDryRunExecutorJson;
  markdown: string;
  jsonPath: string;
  markdownPath: string;
}

export type BranchDryRunIntentInput = BranchCreationIntentJson | Record<string, unknown>;
