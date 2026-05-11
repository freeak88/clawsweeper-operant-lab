import type { CommitDryRunExecutorJson } from "../commit-dry-run-executor/types.js";
import type { CommitIntentJson } from "../commit-intent/types.js";

export type CommitGuardedExecutionStatus = "dry_run" | "committed" | "blocked" | "needs_review";
export type CommitGuardedExecutionNextStep =
  | "stop"
  | "request_human_review"
  | "prepare_pr_creation";

export interface CommitGuardedSafetyCheck {
  check: string;
  passed: boolean;
  message: string;
}

export interface CommitGuardedExecutionJson {
  execution_id: string;
  commit_intent_id: string;
  status: CommitGuardedExecutionStatus;
  would_execute: boolean;
  did_execute: boolean;
  commands: string[];
  commit_hash: string | null;
  rollback_instruction: string;
  recommended_next_step: CommitGuardedExecutionNextStep;
  blocked_reason: string | null;
}

export interface CommitGuardedGitRunner {
  changedFiles(): string[];
  stageFiles(files: string[]): void;
  commit(message: string): void;
  revParseHead(): string;
}

export interface CommitGuardedExecutorOptions {
  commitIntent: CommitIntentJson | Record<string, unknown> | unknown;
  preview: CommitDryRunExecutorJson | Record<string, unknown> | unknown;
  execute?: boolean | undefined;
  gitRunner?: CommitGuardedGitRunner | undefined;
}

export interface CommitGuardedExecutorRunOptions {
  commitIntentPath: string;
  previewPath: string;
  outputRoot: string;
  execute?: boolean | undefined;
}

export interface CommitGuardedExecutorRunResult {
  execution: CommitGuardedExecutionJson;
  markdown: string;
  jsonPath: string;
  markdownPath: string;
}
