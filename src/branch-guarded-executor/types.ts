import type { BranchCreationIntentJson } from "../branch-creation-intent/types.js";
import type { BranchDryRunExecutorJson } from "../branch-dry-run-executor/types.js";

export type BranchGuardedExecutionStatus = "dry_run" | "executed" | "blocked" | "needs_review";
export type BranchGuardedExecutionNextStep =
  | "stop"
  | "request_human_review"
  | "run_local_validation";

export interface BranchGuardedSafetyCheck {
  check: string;
  passed: boolean;
  message: string;
}

export interface BranchGuardedExecutionJson {
  execution_id: string;
  branch_intent_id: string;
  status: BranchGuardedExecutionStatus;
  would_execute: boolean;
  did_execute: boolean;
  command: string;
  safety_checks: BranchGuardedSafetyCheck[];
  rollback_instruction: string;
  recommended_next_step: BranchGuardedExecutionNextStep;
  blocked_reason: string | null;
}

export interface BranchGuardedGitRunner {
  isWorkingTreeClean(): boolean;
  currentBranch(): string;
  branchExists(branchName: string): boolean;
  refExists(refName: string): boolean;
  createBranch(branchName: string, baseRef: string): void;
}

export interface BranchGuardedExecutorOptions {
  branchIntent: BranchCreationIntentJson | Record<string, unknown> | unknown;
  preview: BranchDryRunExecutorJson | Record<string, unknown> | unknown;
  execute?: boolean | undefined;
  gitRunner?: BranchGuardedGitRunner | undefined;
}

export interface BranchGuardedExecutorRunOptions {
  branchIntentPath: string;
  previewPath: string;
  outputRoot: string;
  execute?: boolean | undefined;
}

export interface BranchGuardedExecutorRunResult {
  execution: BranchGuardedExecutionJson;
  markdown: string;
  jsonPath: string;
  markdownPath: string;
}
