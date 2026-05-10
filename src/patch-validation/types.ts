import type { PatchProposalJson } from "../patch-generation/types.js";

export type PatchValidationStatus = "valid" | "blocked" | "needs_review";
export type PatchValidationNextStep =
  | "stop"
  | "request_human_review"
  | "eligible_for_shadow_execution";

export interface PatchValidationCheck {
  check: string;
  passed: boolean;
  message: string;
}

export interface PatchValidationJson {
  validation_id: string;
  patch_id: string;
  status: PatchValidationStatus;
  checks: PatchValidationCheck[];
  blocking_risks: string[];
  warnings: string[];
  recommended_next_step: PatchValidationNextStep;
  summary: string;
}

export interface PatchValidationRunOptions {
  patchPath: string;
  outputRoot: string;
}

export interface PatchValidationRunResult {
  validation: PatchValidationJson;
  markdown: string;
  jsonPath: string;
  markdownPath: string;
}

export type PatchValidationInput = PatchProposalJson | Record<string, unknown>;
