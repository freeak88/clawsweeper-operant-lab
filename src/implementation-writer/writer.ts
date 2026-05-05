import type { ApprovedImplementationPlan } from "../approval-gate/types.js";
import type { ImprovementProposal } from "../improvement-loop/types.js";
import type {
  BlockedImplementationWriterOutput,
  ImplementationPromptJson,
  ImplementationWriterOutput,
  ImplementationWriterPlanInput,
} from "./types.js";

const NON_GOALS = [
  "Do not execute code changes automatically.",
  "Do not create commits.",
  "Do not create PRs.",
  "Do not push branches.",
  "Do not mutate GitHub.",
  "Do not dispatch repairs.",
  "Do not change scheduler/apply/automerge behavior outside the approved scope.",
  "Do not bypass or weaken tests.",
  "Do not use autonomous execution language.",
].sort();

const FINAL_RESPONSE_REQUIREMENTS = [
  "Files changed.",
  "Commands run.",
  "Test results.",
  "Implementation summary.",
  "Rollback notes.",
  "Confirmation that no GitHub mutation, PR creation, push, merge, repair dispatch, or scheduler/apply/automerge behavior change occurred unless explicitly implemented inside the approved local scope.",
];

export function writeImplementationPromptFromPlan(planInput: ImplementationWriterPlanInput): {
  output: ImplementationWriterOutput;
  markdown?: string | undefined;
} {
  const plan = parseApprovedPlan(planInput);
  if (!plan) {
    const blocked = blockedOutput(
      planInput,
      "plan is missing, blocked, invalid, or not approved_for_planning",
    );
    return { output: blocked };
  }
  if (plan.approval_scope !== "implementation_plan_only") {
    return { output: blockedOutput(plan, "approval scope must be implementation_plan_only") };
  }

  const output: ImplementationPromptJson = {
    prompt_id: promptId(plan.plan_id),
    plan_id: plan.plan_id,
    proposal_id: plan.proposal_id,
    status: "ready_for_supervised_implementation",
    markdown_file: "implementation-prompt.md",
    sections: {
      goal: `Implement the approved planning proposal ${plan.proposal_id} under human supervision.`,
      context: contextFor(plan),
      exact_scope: exactScopeFor(plan),
      files_likely_changed: [...plan.files_likely_changed].sort(),
      implementation_steps: [...plan.implementation_steps],
      tests_required: [...plan.tests_required],
      rollback_plan: [...plan.rollback_plan],
      safety_constraints: [...plan.safety_constraints, ...NON_GOALS].sort(),
      non_goals: NON_GOALS,
      final_response_requirements: FINAL_RESPONSE_REQUIREMENTS,
    },
  };

  return {
    output,
    markdown: renderPromptMarkdown(output),
  };
}

export function renderPromptMarkdown(prompt: ImplementationPromptJson): string {
  return [
    "# Supervised Implementation Prompt",
    "",
    "## Goal",
    "",
    prompt.sections.goal,
    "",
    "## Context",
    "",
    bulletList(prompt.sections.context),
    "",
    "## Exact Scope",
    "",
    bulletList(prompt.sections.exact_scope),
    "",
    "## Files Likely Changed",
    "",
    bulletList(prompt.sections.files_likely_changed),
    "",
    "## Implementation Steps",
    "",
    numberedList(prompt.sections.implementation_steps),
    "",
    "## Tests Required",
    "",
    bulletList(prompt.sections.tests_required),
    "",
    "## Rollback Plan",
    "",
    bulletList(prompt.sections.rollback_plan),
    "",
    "## Safety Constraints",
    "",
    bulletList(prompt.sections.safety_constraints),
    "",
    "## Non-Goals",
    "",
    bulletList(prompt.sections.non_goals),
    "",
    "## Final Response Requirements",
    "",
    bulletList(prompt.sections.final_response_requirements),
    "",
  ].join("\n");
}

function parseApprovedPlan(value: unknown): ApprovedImplementationPlan | undefined {
  if (!isObject(value)) return undefined;
  if (value.status !== "approved_for_planning") return undefined;
  if (value.approval_scope !== "implementation_plan_only") return undefined;
  if (typeof value.plan_id !== "string" || !value.plan_id) return undefined;
  if (typeof value.proposal_id !== "string" || !value.proposal_id) return undefined;
  if (typeof value.approved_by !== "string" || !value.approved_by) return undefined;
  if (typeof value.approved_at !== "string" || !value.approved_at) return undefined;
  if (!stringArray(value.implementation_steps)) return undefined;
  if (!stringArray(value.files_likely_changed)) return undefined;
  if (!stringArray(value.tests_required)) return undefined;
  if (!stringArray(value.rollback_plan)) return undefined;
  if (!stringArray(value.safety_constraints)) return undefined;
  if (!isObject(value.source_proposal)) return undefined;
  return {
    plan_id: value.plan_id,
    proposal_id: value.proposal_id,
    status: "approved_for_planning",
    approved_by: value.approved_by,
    approved_at: value.approved_at,
    approval_scope: "implementation_plan_only",
    implementation_steps: [...value.implementation_steps],
    files_likely_changed: [...value.files_likely_changed].sort(),
    tests_required: [...value.tests_required],
    rollback_plan: [...value.rollback_plan],
    safety_constraints: [...value.safety_constraints].sort(),
    source_proposal: value.source_proposal as unknown as ImprovementProposal,
  };
}

function contextFor(plan: ApprovedImplementationPlan): string[] {
  return [
    `Approved by ${plan.approved_by} at ${plan.approved_at}.`,
    `Approval scope is ${plan.approval_scope}.`,
    `Source proposal category: ${plan.source_proposal.category}.`,
    `Source proposal risk level: ${plan.source_proposal.risk_level}.`,
    `Source proposal confidence score: ${plan.source_proposal.confidence_score}.`,
    `Problem: ${plan.source_proposal.problem_summary}`,
    `Expected benefit: ${plan.source_proposal.expected_benefit}`,
  ];
}

function exactScopeFor(plan: ApprovedImplementationPlan): string[] {
  return [
    plan.source_proposal.proposed_change,
    "Keep the implementation limited to the approved implementation plan.",
    "Preserve existing scheduler/apply/automerge behavior unless the plan explicitly asks for local documentation or generated-state changes.",
    "Use the listed files and tests as the initial boundary for the patch.",
  ];
}

function blockedOutput(value: unknown, reason: string): BlockedImplementationWriterOutput {
  const planId = isObject(value) && typeof value.plan_id === "string" ? value.plan_id : "unknown";
  const proposalId =
    isObject(value) && typeof value.proposal_id === "string" ? value.proposal_id : "unknown";
  return {
    prompt_id: promptId(planId),
    plan_id: planId,
    proposal_id: proposalId,
    status: "blocked",
    blocked_reason: reason,
    safety_constraints: NON_GOALS,
  };
}

function promptId(planId: string): string {
  return `prompt-${planId}`;
}

function bulletList(items: readonly string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function numberedList(items: readonly string[]): string {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
