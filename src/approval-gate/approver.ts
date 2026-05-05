import type { ApprovalGateOutput, OperatorApprovalRecord } from "./types.js";
import type {
  GuardedPrSuggestion,
  ImprovementProposal,
  ImprovementSimulation,
} from "../improvement-loop/types.js";

export function evaluateApprovalGate(options: {
  proposal: unknown;
  approval?: unknown | undefined;
  simulation?: unknown | undefined;
  suggestion?: unknown | undefined;
}): ApprovalGateOutput {
  const proposal = parseProposal(options.proposal);
  if (!proposal) return blocked("unknown", "missing or invalid improvement proposal");

  const approval = parseApproval(options.approval);
  if (!approval) return blocked(proposal.proposal_id, "missing or invalid operator approval");
  if (approval.proposal_id !== proposal.proposal_id) {
    return blocked(proposal.proposal_id, "approval proposal_id does not match proposal");
  }
  if (!approval.approved) return blocked(proposal.proposal_id, "operator approval is false");
  if (approval.approval_scope !== "implementation_plan_only") {
    return blocked(proposal.proposal_id, "approval scope must be implementation_plan_only");
  }

  return {
    plan_id: planId(proposal.proposal_id),
    proposal_id: proposal.proposal_id,
    status: "approved_for_planning",
    approved_by: approval.approved_by,
    approved_at: approval.approved_at,
    approval_scope: "implementation_plan_only",
    implementation_steps: implementationSteps(proposal),
    files_likely_changed: filesLikelyChanged(proposal),
    tests_required: testsRequired(proposal),
    rollback_plan: rollbackPlan(proposal),
    safety_constraints: safetyConstraints(),
    source_proposal: proposal,
    source_simulation: parseSimulation(options.simulation, proposal.proposal_id),
    source_pr_suggestion: parseSuggestion(options.suggestion, proposal.proposal_id),
  };
}

function parseProposal(value: unknown): ImprovementProposal | undefined {
  if (!isObject(value)) return undefined;
  if (typeof value.proposal_id !== "string" || !value.proposal_id) return undefined;
  if (!category(value.category)) return undefined;
  if (typeof value.problem_summary !== "string" || !value.problem_summary) return undefined;
  if (!Array.isArray(value.observed_signals)) return undefined;
  if (typeof value.proposed_change !== "string" || !value.proposed_change) return undefined;
  if (typeof value.expected_benefit !== "string" || !value.expected_benefit) return undefined;
  if (!["low", "medium", "high"].includes(String(value.risk_level))) return undefined;
  if (typeof value.confidence_score !== "number" || !Number.isFinite(value.confidence_score)) {
    return undefined;
  }
  return {
    proposal_id: value.proposal_id,
    category: value.category,
    problem_summary: value.problem_summary,
    observed_signals: value.observed_signals
      .filter((signal): signal is string => typeof signal === "string")
      .sort(),
    proposed_change: value.proposed_change,
    expected_benefit: value.expected_benefit,
    risk_level: value.risk_level as ImprovementProposal["risk_level"],
    confidence_score: round(value.confidence_score),
  };
}

function parseApproval(value: unknown): OperatorApprovalRecord | undefined {
  if (!isObject(value)) return undefined;
  if (typeof value.proposal_id !== "string" || !value.proposal_id) return undefined;
  if (typeof value.approved !== "boolean") return undefined;
  if (typeof value.approved_by !== "string" || !value.approved_by) return undefined;
  if (typeof value.approved_at !== "string" || !value.approved_at) return undefined;
  if (value.approval_scope !== "implementation_plan_only") return undefined;
  if (typeof value.notes !== "string") return undefined;
  return {
    proposal_id: value.proposal_id,
    approved: value.approved,
    approved_by: value.approved_by,
    approved_at: value.approved_at,
    approval_scope: "implementation_plan_only",
    notes: value.notes,
  };
}

function parseSimulation(value: unknown, proposalId: string): ImprovementSimulation | undefined {
  if (!isObject(value) || value.proposal_id !== proposalId) return undefined;
  if (
    typeof value.estimated_backlog_reduction !== "number" ||
    typeof value.estimated_shard_utilization_change !== "number" ||
    typeof value.estimated_confidence_improvement !== "number" ||
    typeof value.estimated_repair_reduction !== "number" ||
    !Array.isArray(value.simulation_notes)
  ) {
    return undefined;
  }
  return {
    proposal_id: proposalId,
    estimated_backlog_reduction: round(value.estimated_backlog_reduction),
    estimated_shard_utilization_change: round(value.estimated_shard_utilization_change),
    estimated_confidence_improvement: round(value.estimated_confidence_improvement),
    estimated_repair_reduction: round(value.estimated_repair_reduction),
    simulation_notes: value.simulation_notes
      .filter((note): note is string => typeof note === "string")
      .sort(),
  };
}

function parseSuggestion(value: unknown, proposalId: string): GuardedPrSuggestion | undefined {
  if (!isObject(value) || value.proposal_id !== proposalId) return undefined;
  if (
    typeof value.title !== "string" ||
    typeof value.summary !== "string" ||
    !Array.isArray(value.safety_notes) ||
    !Array.isArray(value.affected_systems)
  ) {
    return undefined;
  }
  return {
    proposal_id: proposalId,
    title: value.title,
    summary: value.summary,
    safety_notes: value.safety_notes
      .filter((note): note is string => typeof note === "string")
      .sort(),
    affected_systems: value.affected_systems.filter(category).sort(),
  };
}

function implementationSteps(proposal: ImprovementProposal): string[] {
  return [
    `Review source evidence for ${proposal.proposal_id}.`,
    `Draft a minimal implementation for the ${proposal.category} improvement.`,
    "Keep changes behind explicit flags or generated-state boundaries where applicable.",
    "Run focused tests before broader validation.",
    "Prepare a human-reviewed PR; do not create or merge it automatically.",
  ];
}

function filesLikelyChanged(proposal: ImprovementProposal): string[] {
  const base = [`docs/${proposal.category}-improvement-plan.md`, "test/<focused-test>.test.ts"];
  switch (proposal.category) {
    case "scheduler":
      return ["src/adaptive-scheduler/", ...base].sort();
    case "routing":
      return ["src/model-routing/", ...base].sort();
    case "policy":
      return ["src/policy-rfc/", "src/policy-dsl/", ...base].sort();
    case "memory":
      return ["src/review-memory/", ...base].sort();
    case "review":
      return ["src/confidence-engine/", ...base].sort();
    case "repair":
      return ["src/repair/", ...base].sort();
  }
  return base.sort();
}

function testsRequired(proposal: ImprovementProposal): string[] {
  return [
    "pnpm run build",
    "targeted oxlint for changed files",
    "targeted oxfmt for changed files",
    `node --test test/${proposal.category}-improvement.test.ts`,
    "existing relevant Operant layer tests",
  ];
}

function rollbackPlan(proposal: ImprovementProposal): string[] {
  return [
    `Revert the implementation commit for ${proposal.proposal_id}.`,
    "Remove any generated-state artifacts created for the implementation review.",
    "Keep existing scheduler/apply/automerge behavior unchanged during rollback.",
  ];
}

function safetyConstraints(): string[] {
  return [
    "Approval authorizes implementation planning only.",
    "Do not create PRs automatically.",
    "Do not mutate GitHub.",
    "Do not merge PRs.",
    "Do not dispatch repairs.",
    "Do not change scheduler/apply/automerge behavior automatically.",
  ];
}

function blocked(proposalId: string, reason: string): ApprovalGateOutput {
  return {
    plan_id: planId(proposalId),
    proposal_id: proposalId,
    status: "blocked",
    blocked_reason: reason,
    safety_constraints: safetyConstraints(),
  };
}

function planId(proposalId: string): string {
  return `plan-${proposalId}`;
}

function category(value: unknown): value is ImprovementProposal["category"] {
  return ["scheduler", "routing", "policy", "memory", "review", "repair"].includes(String(value));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function round(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000;
}
