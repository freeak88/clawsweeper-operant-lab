import type { GuardedPrSuggestion, ImprovementProposal, OperationalWeakness } from "./types.js";

export function planImprovementProposals(
  weaknesses: readonly OperationalWeakness[],
): ImprovementProposal[] {
  return weaknesses.map(proposalForWeakness).sort(compareProposals);
}

export function guardedPrSuggestionsFor(
  proposals: readonly ImprovementProposal[],
): GuardedPrSuggestion[] {
  return proposals
    .map((proposal) => ({
      proposal_id: proposal.proposal_id,
      title: `Proposal: ${titleCase(proposal.category)} improvement for ${proposal.proposal_id}`,
      summary: [
        proposal.problem_summary,
        `Proposed change: ${proposal.proposed_change}`,
        `Expected benefit: ${proposal.expected_benefit}`,
        "This is a proposal-ready PR suggestion only; no PR is created automatically.",
      ].join("\n\n"),
      safety_notes: [
        "No GitHub mutation.",
        "No autonomous merge.",
        "No scheduler/apply/automerge behavior change.",
        "No repair dispatch.",
        "Requires explicit operator review before implementation.",
      ],
      affected_systems: [proposal.category],
    }))
    .sort((left, right) => left.proposal_id.localeCompare(right.proposal_id));
}

function proposalForWeakness(weakness: OperationalWeakness): ImprovementProposal {
  const details = detailsForWeakness(weakness);
  return {
    proposal_id: `improve-${weakness.category}-${weakness.weakness_type}-${suffix(weakness.weakness_id)}`,
    category: weakness.category,
    problem_summary: weakness.summary,
    observed_signals: [...weakness.observed_signals].sort(),
    proposed_change: details.proposedChange,
    expected_benefit: details.expectedBenefit,
    risk_level: weakness.severity,
    confidence_score: weakness.confidence_score,
  };
}

function detailsForWeakness(weakness: OperationalWeakness): {
  proposedChange: string;
  expectedBenefit: string;
} {
  switch (weakness.weakness_type) {
    case "saturated_backlog":
    case "adaptive_scheduler_recommendation":
      return {
        proposedChange:
          "Prepare an operator-reviewed scheduler capacity proposal using adaptive scheduler evidence.",
        expectedBenefit:
          "Reduce due backlog pressure without changing runtime capacity automatically.",
      };
    case "failed_shards":
      return {
        proposedChange:
          "Open an investigation proposal for shard failure clustering before capacity tuning.",
        expectedBenefit: "Avoid scaling a failing lane and focus operator attention on root cause.",
      };
    case "repeated_repair_marker":
    case "repeated_policy_rfc_draft":
      return {
        proposedChange: "Promote stable repeated evidence into a Policy RFC review queue.",
        expectedBenefit: "Convert repeated operational knowledge into reviewable policy proposals.",
      };
    case "recurring_conflict_type":
      return {
        proposedChange:
          "Create a shadow-only Policy DSL candidate for recurring conflict classification.",
        expectedBenefit:
          "Measure whether repeat conflicts can be safely triaged before repair dispatch.",
      };
    case "low_confidence_pattern":
      return {
        proposedChange:
          "Add confidence evidence requirements and keep the affected action in observe mode.",
        expectedBenefit:
          "Reduce false-positive action candidates by requiring stronger green signals.",
      };
    case "stale_review_queue":
      return {
        proposedChange:
          "Prepare a review freshness proposal that surfaces stale queues in status output.",
        expectedBenefit:
          "Improve operator visibility without changing planner ordering automatically.",
      };
    case "model_routing_mismatch":
      return {
        proposedChange:
          "Compare model-routing recommendations with confidence and memory outcomes.",
        expectedBenefit:
          "Identify review surfaces that may need stronger reasoning before any routing change.",
      };
  }
}

function compareProposals(left: ImprovementProposal, right: ImprovementProposal): number {
  return left.proposal_id.localeCompare(right.proposal_id);
}

function suffix(value: string): string {
  return value.split("-").at(-1) ?? value;
}

function titleCase(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}
