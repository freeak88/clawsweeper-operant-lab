import { evaluateApprovalGate } from "../approval-gate/approver.js";
import { generatePatchProposal } from "../patch-generation/generator.js";
import { validatePatchProposal } from "../patch-validation/validator.js";
import { planPrCreationIntent } from "../pr-creation-intent/planner.js";
import { executeShadowPatch } from "../shadow-patch-execution/executor.js";
import type {
  SupervisedPatchPipelineDemoReport,
  SupervisedPatchPipelineDemoScenario,
} from "./types.js";

const DEFAULT_GENERATED_AT = "2026-05-09T12:00:00.000Z";

export function buildSupervisedPatchPipelineDemo(
  options: {
    scenario?: SupervisedPatchPipelineDemoScenario | undefined;
    generatedAt?: string | undefined;
  } = {},
): SupervisedPatchPipelineDemoReport {
  const scenario = options.scenario ?? "happy_path";
  const generatedAt = options.generatedAt ?? DEFAULT_GENERATED_AT;
  const proposal = syntheticImprovementProposal();
  const simulation = syntheticSimulation(proposal.proposal_id);
  const suggestion = syntheticSuggestion(proposal.proposal_id);
  const approval = syntheticApproval(proposal.proposal_id, generatedAt, scenario);
  const approvalGate = evaluateApprovalGate({
    proposal,
    approval,
    simulation,
    suggestion,
  });
  const patchProposal = generatePatchProposal({ plan: approvalGate });
  const validationInput =
    scenario === "needs_review_validation"
      ? { ...patchProposal, files_to_modify: ["src/clawsweeper.ts"] }
      : patchProposal;
  const patchValidation = validatePatchProposal(validationInput);
  const shadowPatchExecution = executeShadowPatch({
    patch: patchProposal,
    validation: patchValidation,
  });
  const prCreationIntent = planPrCreationIntent({
    patch: patchProposal,
    validation: patchValidation,
    shadow: shadowPatchExecution,
    approval: syntheticPrIntentApproval(patchProposal.patch_id, generatedAt),
  });

  return {
    schema_version: 1,
    generated_at: generatedAt,
    scenario,
    summary: {
      final_status: prCreationIntent.status,
      approval_status: approvalGate.status,
      patch_status: patchProposal.status,
      validation_status: patchValidation.status,
      shadow_status: shadowPatchExecution.status,
      pr_intent_status: prCreationIntent.status,
      executed_count: 0,
    },
    artifacts: {
      approval_gate: approvalGate,
      patch_proposal: patchProposal,
      patch_validation: patchValidation,
      shadow_patch_execution: shadowPatchExecution,
      pr_creation_intent: prCreationIntent,
    },
    safety_boundary: safetyBoundary(),
  };
}

export function renderSupervisedPatchPipelineDemoMarkdown(
  report: SupervisedPatchPipelineDemoReport,
): string {
  return [
    "# Supervised Patch Pipeline Demo",
    "",
    "> Synthetic artifact-only demo. No GitHub mutation, branch creation, commit, push, PR creation, patch application, source mutation, or scheduler/apply/automerge change occurred.",
    "",
    "## Summary",
    "",
    `- Generated at: \`${report.generated_at}\``,
    `- Scenario: \`${report.scenario}\``,
    `- Final status: \`${report.summary.final_status}\``,
    `- Executed count: \`${report.summary.executed_count}\``,
    "",
    "## Pipeline",
    "",
    "| Step | Status |",
    "| --- | --- |",
    `| Approval Gate | \`${report.summary.approval_status}\` |`,
    `| Patch Generation | \`${report.summary.patch_status}\` |`,
    `| Patch Validation | \`${report.summary.validation_status}\` |`,
    `| Shadow Patch Execution | \`${report.summary.shadow_status}\` |`,
    `| PR Creation Intent | \`${report.summary.pr_intent_status}\` |`,
    "",
    "## Final PR Intent",
    "",
    `- Intent id: \`${report.artifacts.pr_creation_intent.intent_id}\``,
    `- Patch id: \`${report.artifacts.pr_creation_intent.patch_id}\``,
    `- Status: \`${report.artifacts.pr_creation_intent.status}\``,
    `- Recommended next step: \`${report.artifacts.pr_creation_intent.recommended_next_step}\``,
    report.artifacts.pr_creation_intent.blocked_reason
      ? `- Blocked reason: ${report.artifacts.pr_creation_intent.blocked_reason}`
      : "- Blocked reason: none",
    "",
    "## Files Expected",
    "",
    bulletList(report.artifacts.pr_creation_intent.files_expected),
    "",
    "## Tests Required",
    "",
    bulletList(report.artifacts.pr_creation_intent.tests_required),
    "",
    "## Safety Boundary",
    "",
    "- No GitHub mutation.",
    "- No branch creation.",
    "- No commits.",
    "- No push.",
    "- No PR creation.",
    "- No patch application.",
    "- No source mutation.",
    "- No scheduler/apply/automerge changes.",
    "",
  ].join("\n");
}

function syntheticImprovementProposal() {
  return {
    proposal_id: "memory-policy-signal-tightening-demo",
    category: "memory" as const,
    problem_summary:
      "Repeated low-confidence repair markers need a clearer local memory summary before implementation work.",
    observed_signals: [
      "repeated repair marker: stale-generated-state",
      "low confidence pattern: repair_acceptance",
      "recurring conflict type: generated report drift",
    ],
    proposed_change:
      "Add a narrow review-memory summarization improvement with focused tests and generated-state documentation.",
    expected_benefit:
      "Operators get a clearer pre-PR patch plan while scheduler/apply/automerge behavior remains unchanged.",
    risk_level: "low" as const,
    confidence_score: 0.91,
  };
}

function syntheticSimulation(proposalId: string) {
  return {
    proposal_id: proposalId,
    estimated_backlog_reduction: 0.12,
    estimated_shard_utilization_change: 0.02,
    estimated_confidence_improvement: 0.18,
    estimated_repair_reduction: 0.08,
    simulation_notes: [
      "Static synthetic demo estimate only.",
      "No live scheduler or GitHub data was queried.",
    ],
  };
}

function syntheticSuggestion(proposalId: string) {
  return {
    proposal_id: proposalId,
    title: "Improve review-memory signal summary",
    summary:
      "Prepare a supervised implementation plan for a local review-memory reporting improvement.",
    safety_notes: [
      "Proposal-only generated plan.",
      "No scheduler/apply/automerge behavior changes.",
    ],
    affected_systems: ["memory" as const],
  };
}

function syntheticApproval(
  proposalId: string,
  generatedAt: string,
  scenario: SupervisedPatchPipelineDemoScenario,
) {
  return {
    proposal_id: proposalId,
    approved: scenario !== "blocked_approval",
    approved_by: "operator",
    approved_at: generatedAt,
    approval_scope: "implementation_plan_only",
    notes:
      scenario === "blocked_approval"
        ? "Synthetic blocked approval path."
        : "Synthetic approval for implementation planning only.",
  };
}

function syntheticPrIntentApproval(patchId: string, generatedAt: string) {
  return {
    patch_id: patchId,
    approved: true,
    approved_by: "operator",
    approved_at: generatedAt,
    approval_scope: "pr_creation_intent_only",
    notes: "Synthetic approval for PR creation intent only.",
  };
}

function safetyBoundary(): SupervisedPatchPipelineDemoReport["safety_boundary"] {
  return {
    github_mutation: false,
    branch_creation: false,
    commit_creation: false,
    push: false,
    pr_creation: false,
    patch_application: false,
    source_mutation: false,
    scheduler_apply_automerge_change: false,
  };
}

function bulletList(items: readonly string[]): string {
  if (items.length === 0) return "- none";
  return items.map((item) => `- ${item}`).join("\n");
}
