import type { ApprovedImplementationPlan } from "../approval-gate/types.js";
import type { ImplementationPromptJson } from "../implementation-writer/types.js";
import type {
  PatchGenerationPlanInput,
  PatchGenerationPromptInput,
  PatchProposalJson,
} from "./types.js";

const NON_GOALS = [
  "Do not apply patches.",
  "Do not create commits.",
  "Do not create PRs.",
  "Do not merge.",
  "Do not mutate GitHub.",
  "Do not push branches.",
  "Do not dispatch repairs.",
  "Do not change scheduler/apply/automerge behavior outside the approved plan.",
  "Do not use autonomous execution language.",
].sort();

export function generatePatchProposal(options: {
  plan: PatchGenerationPlanInput | unknown;
  promptJson?: PatchGenerationPromptInput | unknown;
  promptMarkdown?: string | undefined;
}): PatchProposalJson {
  const plan = parseApprovedPlan(options.plan);
  if (!plan) {
    return blockedProposal(
      options.plan,
      "plan is missing, malformed, blocked, wrong-scope, or not approved_for_planning",
    );
  }

  const prompt = parsePrompt(options.promptJson, plan.plan_id);
  const intendedChanges = intendedChangesFor(plan, prompt, options.promptMarkdown);
  return {
    patch_id: patchId(plan.plan_id),
    plan_id: plan.plan_id,
    proposal_id: plan.proposal_id,
    status: "patch_proposed",
    summary: `Patch proposal for ${plan.proposal_id}. This is not an applied patch.`,
    intended_changes: intendedChanges,
    files_to_modify: filesToModify(plan),
    files_to_add: filesToAdd(plan),
    tests_to_run: [...plan.tests_required].sort(),
    rollback_plan: [...plan.rollback_plan].sort(),
    safety_constraints: [...plan.safety_constraints, ...NON_GOALS].sort(),
    non_goals: NON_GOALS,
    blocked_reason: null,
  };
}

export function renderPatchProposalMarkdown(proposal: PatchProposalJson): string {
  return [
    "# Supervised Patch Proposal",
    "",
    "> This is a patch proposal artifact only. No patch has been applied.",
    "",
    "## Summary",
    "",
    `- Patch id: \`${proposal.patch_id}\``,
    `- Plan id: \`${proposal.plan_id}\``,
    `- Proposal id: \`${proposal.proposal_id}\``,
    `- Status: \`${proposal.status}\``,
    `- Summary: ${proposal.summary}`,
    proposal.blocked_reason
      ? `- Blocked reason: ${proposal.blocked_reason}`
      : "- Blocked reason: none",
    "",
    "## Intended Changes",
    "",
    bulletList(proposal.intended_changes),
    "",
    "## Files To Modify",
    "",
    bulletList(proposal.files_to_modify),
    "",
    "## Files To Add",
    "",
    bulletList(proposal.files_to_add),
    "",
    "## Tests To Run",
    "",
    bulletList(proposal.tests_to_run),
    "",
    "## Rollback Plan",
    "",
    bulletList(proposal.rollback_plan),
    "",
    "## Safety Constraints",
    "",
    bulletList(proposal.safety_constraints),
    "",
    "## Non-Goals",
    "",
    bulletList(proposal.non_goals),
    "",
  ].join("\n");
}

function parseApprovedPlan(value: unknown): ApprovedImplementationPlan | undefined {
  if (!isObject(value)) return undefined;
  if (value.status !== "approved_for_planning") return undefined;
  if (value.approval_scope !== "implementation_plan_only") return undefined;
  if (typeof value.plan_id !== "string" || !value.plan_id) return undefined;
  if (typeof value.proposal_id !== "string" || !value.proposal_id) return undefined;
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
    approved_by: typeof value.approved_by === "string" ? value.approved_by : "operator",
    approved_at: typeof value.approved_at === "string" ? value.approved_at : "",
    approval_scope: "implementation_plan_only",
    implementation_steps: [...value.implementation_steps],
    files_likely_changed: [...value.files_likely_changed].sort(),
    tests_required: [...value.tests_required].sort(),
    rollback_plan: [...value.rollback_plan].sort(),
    safety_constraints: [...value.safety_constraints].sort(),
    source_proposal:
      value.source_proposal as unknown as ApprovedImplementationPlan["source_proposal"],
  };
}

function parsePrompt(value: unknown, planId: string): ImplementationPromptJson | undefined {
  if (!isObject(value)) return undefined;
  if (value.plan_id !== planId) return undefined;
  if (value.status !== "ready_for_supervised_implementation") return undefined;
  if (!isObject(value.sections)) return undefined;
  const sections = value.sections;
  if (!stringArray(sections.implementation_steps)) return undefined;
  if (!stringArray(sections.exact_scope)) return undefined;
  return value as unknown as ImplementationPromptJson;
}

function intendedChangesFor(
  plan: ApprovedImplementationPlan,
  prompt: ImplementationPromptJson | undefined,
  promptMarkdown: string | undefined,
): string[] {
  const changes = [
    ...plan.implementation_steps,
    ...(prompt?.sections.exact_scope ?? []),
    ...(promptMarkdown
      ? ["Use the supplied implementation prompt Markdown as supplemental context."]
      : []),
  ];
  return sortedUnique(changes);
}

function filesToModify(plan: ApprovedImplementationPlan): string[] {
  return plan.files_likely_changed
    .filter((file) => !looksLikeNewFile(file))
    .filter((file) => !file.includes("<"))
    .sort();
}

function filesToAdd(plan: ApprovedImplementationPlan): string[] {
  return plan.files_likely_changed
    .filter((file) => looksLikeNewFile(file) || file.includes("<"))
    .sort();
}

function looksLikeNewFile(path: string): boolean {
  return path.startsWith("docs/") || path.startsWith("test/");
}

function blockedProposal(value: unknown, reason: string): PatchProposalJson {
  const planId = isObject(value) && typeof value.plan_id === "string" ? value.plan_id : "unknown";
  const proposalId =
    isObject(value) && typeof value.proposal_id === "string" ? value.proposal_id : "unknown";
  return {
    patch_id: patchId(planId),
    plan_id: planId,
    proposal_id: proposalId,
    status: "blocked",
    summary: "Patch proposal generation blocked; no patch was applied.",
    intended_changes: [],
    files_to_modify: [],
    files_to_add: [],
    tests_to_run: [],
    rollback_plan: [],
    safety_constraints: NON_GOALS,
    non_goals: NON_GOALS,
    blocked_reason: reason,
  };
}

function patchId(planId: string): string {
  return `patch-${planId}`;
}

function bulletList(items: readonly string[]): string {
  if (items.length === 0) return "- none";
  return items.map((item) => `- ${item}`).join("\n");
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
