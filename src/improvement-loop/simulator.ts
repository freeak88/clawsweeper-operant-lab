import type { ImprovementProposal, ImprovementSimulation } from "./types.js";

export function simulateImprovementProposals(
  proposals: readonly ImprovementProposal[],
): ImprovementSimulation[] {
  return proposals
    .map(simulationForProposal)
    .sort((left, right) => left.proposal_id.localeCompare(right.proposal_id));
}

function simulationForProposal(proposal: ImprovementProposal): ImprovementSimulation {
  const confidence = bounded(proposal.confidence_score);
  const riskMultiplier = riskMultiplierFor(proposal.risk_level);
  const category = proposal.category;
  return {
    proposal_id: proposal.proposal_id,
    estimated_backlog_reduction: round(
      category === "scheduler" || category === "review"
        ? confidence * 0.18 * riskMultiplier
        : confidence * 0.06 * riskMultiplier,
    ),
    estimated_shard_utilization_change: round(
      category === "scheduler" ? confidence * 0.12 * riskMultiplier : 0,
    ),
    estimated_confidence_improvement: round(
      category === "policy" || category === "memory" || category === "routing"
        ? confidence * 0.14 * riskMultiplier
        : confidence * 0.05 * riskMultiplier,
    ),
    estimated_repair_reduction: round(
      category === "repair" || category === "policy" ? confidence * 0.16 * riskMultiplier : 0,
    ),
    simulation_notes: [
      "static v0.8 heuristic simulation",
      "no runtime settings changed",
      "no GitHub mutation performed",
      `risk level ${proposal.risk_level}`,
    ].sort(),
  };
}

function riskMultiplierFor(riskLevel: ImprovementProposal["risk_level"]): number {
  return { low: 1, medium: 0.7, high: 0.35 }[riskLevel];
}

function bounded(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
