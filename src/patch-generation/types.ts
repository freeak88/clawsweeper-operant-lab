import type { ApprovedImplementationPlan } from "../approval-gate/types.js";
import type { ImplementationPromptJson } from "../implementation-writer/types.js";

export type PatchProposalStatus = "patch_proposed" | "blocked";

export interface PatchProposalJson {
  patch_id: string;
  plan_id: string;
  proposal_id: string;
  status: PatchProposalStatus;
  summary: string;
  intended_changes: string[];
  files_to_modify: string[];
  files_to_add: string[];
  tests_to_run: string[];
  rollback_plan: string[];
  safety_constraints: string[];
  non_goals: string[];
  blocked_reason: string | null;
}

export interface PatchGenerationRunOptions {
  planPath: string;
  outputRoot: string;
  promptJsonPath?: string | undefined;
  promptMarkdownPath?: string | undefined;
}

export interface PatchGenerationRunResult {
  proposal: PatchProposalJson;
  markdown: string;
  jsonPath: string;
  markdownPath: string;
}

export type PatchGenerationPlanInput = ApprovedImplementationPlan | Record<string, unknown>;
export type PatchGenerationPromptInput = ImplementationPromptJson | Record<string, unknown>;
