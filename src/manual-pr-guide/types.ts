import type { BranchCreationIntentJson } from "../branch-creation-intent/types.js";
import type { CommitGuardedExecutionJson } from "../commit-guarded-executor/types.js";
import type { PrPackageJson } from "../pr-package/types.js";

export type ManualPrGuideStatus = "ready" | "blocked" | "needs_review";
export type ManualPrGuideNextStep = "operator_manual_pr_creation" | "stop" | "request_human_review";

export interface ManualPrGuideJson {
  guide_id: string;
  status: ManualPrGuideStatus;
  branch_name: string;
  commit_hash: string;
  pr_title: string;
  pr_body: string;
  manual_steps: string[];
  pre_push_checklist: string[];
  risk_acceptance_checklist: string[];
  rollback_steps: string[];
  do_not_do: string[];
  recommended_next_step: ManualPrGuideNextStep;
  blocked_reason: string | null;
}

export interface ManualPrGuideGeneratorOptions {
  prPackage: PrPackageJson | Record<string, unknown> | unknown;
  branchIntent: BranchCreationIntentJson | Record<string, unknown> | unknown;
  commitExecution: CommitGuardedExecutionJson | Record<string, unknown> | unknown;
}

export interface ManualPrGuideRunOptions {
  prPackagePath: string;
  branchIntentPath: string;
  commitExecutionPath: string;
  outputRoot: string;
}

export interface ManualPrGuideRunResult {
  guide: ManualPrGuideJson;
  markdown: string;
  jsonPath: string;
  markdownPath: string;
}
