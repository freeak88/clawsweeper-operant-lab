import type { ApprovalGateOutput, ApprovedImplementationPlan } from "../approval-gate/types.js";

export interface ImplementationPromptJson {
  prompt_id: string;
  plan_id: string;
  proposal_id: string;
  status: "ready_for_supervised_implementation";
  markdown_file: "implementation-prompt.md";
  sections: {
    goal: string;
    context: string[];
    exact_scope: string[];
    files_likely_changed: string[];
    implementation_steps: string[];
    tests_required: string[];
    rollback_plan: string[];
    safety_constraints: string[];
    non_goals: string[];
    final_response_requirements: string[];
  };
}

export interface BlockedImplementationWriterOutput {
  prompt_id: string;
  plan_id: string;
  proposal_id: string;
  status: "blocked";
  blocked_reason: string;
  safety_constraints: string[];
}

export type ImplementationWriterOutput =
  | ImplementationPromptJson
  | BlockedImplementationWriterOutput;

export interface ImplementationWriterRunOptions {
  planPath: string;
  outputRoot: string;
}

export interface ImplementationWriterRunResult {
  output: ImplementationWriterOutput;
  markdown?: string | undefined;
  jsonPath: string;
  markdownPath?: string | undefined;
}

export type ImplementationWriterPlanInput =
  | ApprovalGateOutput
  | ApprovedImplementationPlan
  | Record<string, unknown>;
