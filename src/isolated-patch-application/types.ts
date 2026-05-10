import type { BranchGuardedExecutionJson } from "../branch-guarded-executor/types.js";
import type { PatchProposalJson } from "../patch-generation/types.js";
import type { PatchValidationJson } from "../patch-validation/types.js";

export type IsolatedPatchApplicationStatus =
  | "dry_run"
  | "applied_isolated"
  | "blocked"
  | "needs_review";
export type IsolatedPatchApplicationNextStep =
  | "stop"
  | "request_human_review"
  | "run_local_validation";

export interface IsolatedPatchApplicationJson {
  application_id: string;
  patch_id: string;
  status: IsolatedPatchApplicationStatus;
  workspace_root: string;
  isolated_workspace: string;
  did_apply: boolean;
  simulated_files: string[];
  applied_files: string[];
  diff_report: string[];
  rollback_instruction: string;
  recommended_next_step: IsolatedPatchApplicationNextStep;
  blocked_reason: string | null;
}

export interface IsolatedPatchApplyResult {
  appliedFiles: string[];
  diffReport: string[];
}

export interface IsolatedPatchRunner {
  prepareWorkspace(workspaceRoot: string, isolatedWorkspace: string): void;
  applyPatch(patch: PatchProposalJson, isolatedWorkspace: string): IsolatedPatchApplyResult;
}

export interface IsolatedPatchApplicationOptions {
  patch: PatchProposalJson | Record<string, unknown> | unknown;
  validation: PatchValidationJson | Record<string, unknown> | unknown;
  branchExecution: BranchGuardedExecutionJson | Record<string, unknown> | unknown;
  workspaceRoot?: string | undefined;
  outputRoot?: string | undefined;
  mainRepoRoot?: string | undefined;
  execute?: boolean | undefined;
  runner?: IsolatedPatchRunner | undefined;
}

export interface IsolatedPatchApplicationRunOptions {
  patchPath: string;
  validationPath: string;
  branchExecutionPath: string;
  outputRoot: string;
  workspaceRoot?: string | undefined;
  execute?: boolean | undefined;
}

export interface IsolatedPatchApplicationRunResult {
  application: IsolatedPatchApplicationJson;
  markdown: string;
  jsonPath: string;
  markdownPath: string;
}
