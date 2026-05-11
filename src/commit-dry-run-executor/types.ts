import type { CommitIntentJson } from "../commit-intent/types.js";

export type CommitDryRunExecutorStatus = "ready" | "blocked" | "needs_review";
export type CommitDryRunExecutorNextStep =
  | "operator_commit_execution_review"
  | "stop"
  | "request_human_review";

export interface CommitDryRunSafetyCheck {
  check: string;
  passed: boolean;
  message: string;
}

export interface CommitDryRunExecutorJson {
  execution_preview_id: string;
  commit_intent_id: string;
  status: CommitDryRunExecutorStatus;
  allowed_commands_preview: string[];
  would_execute: false;
  safety_checks: CommitDryRunSafetyCheck[];
  recommended_next_step: CommitDryRunExecutorNextStep;
  blocked_reason: string | null;
}

export interface CommitDryRunExecutorRunOptions {
  commitIntentPath: string;
  outputRoot: string;
}

export interface CommitDryRunExecutorRunResult {
  preview: CommitDryRunExecutorJson;
  markdown: string;
  jsonPath: string;
  markdownPath: string;
}

export type CommitDryRunIntentInput = CommitIntentJson | Record<string, unknown>;
