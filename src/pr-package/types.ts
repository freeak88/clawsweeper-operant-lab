import type { CommitGuardedExecutionJson } from "../commit-guarded-executor/types.js";
import type { CommitIntentJson } from "../commit-intent/types.js";
import type { IsolatedPatchApplicationJson } from "../isolated-patch-application/types.js";
import type { LocalValidationResultJson } from "../local-validation-runner/types.js";
import type { PatchProposalJson } from "../patch-generation/types.js";

export type PrPackageStatus = "ready" | "blocked" | "needs_review";
export type PrPackageNextStep = "manual_pr_review" | "stop" | "request_human_review";

export interface PrPackageJson {
  pr_package_id: string;
  commit_hash: string;
  status: PrPackageStatus;
  title: string;
  body: string;
  diff_summary: string[];
  validation_evidence: string[];
  rollback_plan: string[];
  risk_notes: string[];
  operator_checklist: string[];
  recommended_next_step: PrPackageNextStep;
  blocked_reason: string | null;
}

export interface PrPackageGeneratorOptions {
  commitExecution: CommitGuardedExecutionJson | Record<string, unknown> | unknown;
  commitIntent: CommitIntentJson | Record<string, unknown> | unknown;
  validation: LocalValidationResultJson | Record<string, unknown> | unknown;
  application: IsolatedPatchApplicationJson | Record<string, unknown> | unknown;
  patch: PatchProposalJson | Record<string, unknown> | unknown;
}

export interface PrPackageRunOptions {
  commitExecutionPath: string;
  commitIntentPath: string;
  validationPath: string;
  applicationPath: string;
  patchPath: string;
  outputRoot: string;
}

export interface PrPackageRunResult {
  prPackage: PrPackageJson;
  markdown: string;
  jsonPath: string;
  markdownPath: string;
}
