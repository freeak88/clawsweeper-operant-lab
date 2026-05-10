import type { IsolatedPatchApplicationJson } from "../isolated-patch-application/types.js";
import type { PatchProposalJson } from "../patch-generation/types.js";

export type LocalValidationRunStatus = "dry_run" | "passed" | "failed" | "blocked" | "needs_review";
export type LocalValidationNextStep = "stop" | "request_human_review" | "prepare_commit_intent";

export interface LocalValidationCommandResult {
  command: string;
  exit_code: number;
  status: "passed" | "failed";
  output: string;
}

export interface LocalValidationResultJson {
  validation_run_id: string;
  patch_id: string;
  status: LocalValidationRunStatus;
  workspace_root: string;
  did_execute: boolean;
  commands: string[];
  results: LocalValidationCommandResult[];
  recommended_next_step: LocalValidationNextStep;
  blocked_reason: string | null;
}

export interface LocalValidationCommandRunner {
  run(command: string, workspaceRoot: string): LocalValidationCommandResult;
}

export interface LocalValidationRunnerOptions {
  application: IsolatedPatchApplicationJson | Record<string, unknown> | unknown;
  patch: PatchProposalJson | Record<string, unknown> | unknown;
  outputRoot?: string | undefined;
  mainRepoRoot?: string | undefined;
  execute?: boolean | undefined;
  runner?: LocalValidationCommandRunner | undefined;
}

export interface LocalValidationRunnerRunOptions {
  applicationPath: string;
  patchPath: string;
  outputRoot: string;
  execute?: boolean | undefined;
}

export interface LocalValidationRunnerRunResult {
  validation: LocalValidationResultJson;
  markdown: string;
  jsonPath: string;
  markdownPath: string;
}
