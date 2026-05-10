import { GOVERNANCE_LAYER_SPECS } from "./collector.js";
import {
  GOVERNANCE_PRINCIPLE,
  type GovernanceArtifact,
  type GovernanceDashboardJson,
  type GovernanceLayerSummary,
  type GovernanceLayerStatus,
} from "./types.js";

const DEFAULT_GENERATED_AT = "2026-05-09T12:00:00.000Z";

export function synthesizeGovernanceDashboard(options: {
  artifacts: readonly GovernanceArtifact[];
  generatedAt?: string | undefined;
}): GovernanceDashboardJson {
  const artifactByLayer = new Map(
    options.artifacts.map((artifact) => [artifact.layer_id, artifact]),
  );
  const layers = GOVERNANCE_LAYER_SPECS.map((spec) => {
    const artifact = artifactByLayer.get(spec.layer_id);
    return artifact
      ? summarizeArtifact(artifact)
      : missingLayer(spec.layer_id, spec.name, spec.stage);
  });
  const summary = {
    observed: sum(layers, "observed"),
    proposals: sum(layers, "proposals"),
    approvals: sum(layers, "approvals"),
    simulations: sum(layers, "simulations"),
    intents: sum(layers, "intents"),
    blocks: sum(layers, "blocks"),
    next_safe_action: nextSafeAction(layers),
  };

  return {
    schema_version: 1,
    generated_at: options.generatedAt ?? DEFAULT_GENERATED_AT,
    principle: GOVERNANCE_PRINCIPLE,
    summary,
    layers,
    safety_posture: safetyPosture(),
  };
}

export function renderGovernanceDashboardMarkdown(dashboard: GovernanceDashboardJson): string {
  return [
    "# Operator Governance Dashboard",
    "",
    `**Principle:** ${dashboard.principle}`,
    "",
    "> Read-only cockpit. No GitHub API calls, GitHub mutation, branch creation, commits, pushes, PR creation, scheduler mutation, or apply/automerge mutation occurred.",
    "",
    "## Summary",
    "",
    `- Generated at: \`${dashboard.generated_at}\``,
    `- Observed: \`${dashboard.summary.observed}\``,
    `- Proposals: \`${dashboard.summary.proposals}\``,
    `- Approvals: \`${dashboard.summary.approvals}\``,
    `- Simulations: \`${dashboard.summary.simulations}\``,
    `- Intents: \`${dashboard.summary.intents}\``,
    `- Blocks: \`${dashboard.summary.blocks}\``,
    `- Next safe action: \`${dashboard.summary.next_safe_action}\``,
    "",
    "## Operator Questions",
    "",
    "- What did it observe?",
    "- What did it propose?",
    "- Who or what approved it?",
    "- What did simulation predict?",
    "- What does it intend to do?",
    "- What blocks action?",
    "- What is the next safe step?",
    "",
    "## Layers",
    "",
    "| Layer | Stage | Status | Artifact | Next Safe Step |",
    "| --- | --- | --- | --- | --- |",
    ...dashboard.layers.map(
      (layer) =>
        `| ${layer.name} | ${layer.stage} | \`${layer.status}\` | ${layer.artifact_path ?? "none"} | ${layer.answers.next_safe_step} |`,
    ),
    "",
    "## Safety Posture",
    "",
    "- GitHub mutation: `false`",
    "- Branch creation: `false`",
    "- Commit creation: `false`",
    "- Push: `false`",
    "- PR creation: `false`",
    "- Scheduler mutation: `false`",
    "- Apply/automerge mutation: `false`",
    "",
  ].join("\n");
}

function summarizeArtifact(artifact: GovernanceArtifact): GovernanceLayerSummary {
  const status = statusFor(artifact.data);
  const counters = countersFor(artifact, status);
  const blocks = blockCount(artifact.data, status);
  return {
    layer_id: artifact.layer_id,
    name: artifact.name,
    stage: artifact.stage,
    status,
    artifact_path: artifact.artifact_path,
    ...counters,
    blocks,
    answers: answersFor(artifact, status, counters, blocks),
  };
}

function missingLayer(
  layerId: string,
  name: string,
  stage: GovernanceLayerSummary["stage"],
): GovernanceLayerSummary {
  return {
    layer_id: layerId,
    name,
    stage,
    status: "missing",
    artifact_path: null,
    observed: 0,
    proposals: 0,
    approvals: 0,
    simulations: 0,
    intents: 0,
    blocks: 0,
    answers: {
      observed: "No artifact available.",
      proposed: "No proposal artifact available.",
      approved: "No approval artifact available.",
      simulation: "No simulation artifact available.",
      intent: "No intent artifact available.",
      blocks: "No blocking artifact available.",
      next_safe_step: "collect_more_evidence",
    },
  };
}

function countersFor(
  artifact: GovernanceArtifact,
  status: GovernanceLayerStatus,
): Omit<
  GovernanceLayerSummary,
  "layer_id" | "name" | "stage" | "status" | "artifact_path" | "blocks" | "answers"
> {
  const summary = objectValue(artifact.data.summary);
  const observed =
    numberValue(summary.record_count) ||
    numberValue(summary.pattern_count) ||
    numberValue(summary.weakness_count) ||
    arrayLength(artifact.data.patterns) ||
    arrayLength(artifact.data.items);
  const proposals =
    numberValue(summary.proposal_count) ||
    numberValue(summary.policy_rfc_count) ||
    (artifact.layer_id.includes("proposal") || artifact.layer_id === "patch_generation" ? 1 : 0);
  const approvals =
    artifact.layer_id === "approval_gate" && status === "ready"
      ? 1
      : artifact.layer_id === "promotion" &&
          ["candidate", "approved"].includes(String(artifact.data.current_status))
        ? 1
        : 0;
  const simulations =
    numberValue(summary.simulation_count) ||
    numberValue(summary.match_count) ||
    (artifact.layer_id.includes("shadow") && status !== "blocked" ? 1 : 0);
  const intents =
    numberValue(summary.pr_suggestion_count) ||
    (artifact.layer_id.includes("intent") && status === "ready" ? 1 : 0) ||
    (artifact.layer_id === "implementation_writer" && status === "ready" ? 1 : 0);
  return { observed, proposals, approvals, simulations, intents };
}

function statusFor(data: Record<string, unknown>): GovernanceLayerStatus {
  const status = String(data.status ?? data.current_status ?? "");
  if (status === "blocked") return "blocked";
  if (status === "needs_review") return "needs_review";
  if (
    status === "ready" ||
    status === "simulated" ||
    status === "valid" ||
    status === "patch_proposed" ||
    status === "approved_for_planning" ||
    status === "ready_for_supervised_implementation"
  ) {
    return "ready";
  }
  if (status || data.schema_version || data.summary) return "available";
  return "not_available";
}

function blockCount(data: Record<string, unknown>, status: GovernanceLayerStatus): number {
  const explicit =
    arrayLength(data.blocking_risks) +
    (typeof data.blocked_reason === "string" && data.blocked_reason ? 1 : 0);
  if (explicit > 0) return explicit;
  return status === "blocked" || status === "needs_review" ? 1 : 0;
}

function answersFor(
  artifact: GovernanceArtifact,
  status: GovernanceLayerStatus,
  counters: ReturnType<typeof countersFor>,
  blocks: number,
): GovernanceLayerSummary["answers"] {
  return {
    observed: counters.observed
      ? `${artifact.name} observed ${counters.observed} signal(s).`
      : "No direct observation count.",
    proposed: counters.proposals
      ? `${artifact.name} produced ${counters.proposals} proposal signal(s).`
      : "No proposal signal.",
    approved: counters.approvals
      ? `${artifact.name} contains approval evidence.`
      : "No approval evidence.",
    simulation: counters.simulations
      ? `${artifact.name} contains simulation evidence.`
      : "No simulation evidence.",
    intent: counters.intents ? `${artifact.name} contains intent evidence.` : "No intent evidence.",
    blocks: blocks
      ? `${artifact.name} has ${blocks} block/review signal(s).`
      : "No blocks surfaced.",
    next_safe_step: nextStepForStatus(status),
  };
}

function nextSafeAction(layers: readonly GovernanceLayerSummary[]): string {
  if (layers.some((layer) => layer.status === "blocked")) return "request_human_review";
  if (layers.some((layer) => layer.status === "needs_review")) return "request_human_review";
  if (layerReady(layers, "pr_creation_intent")) return "manual_pr_creation_review";
  if (layerReady(layers, "supervised_patch_pipeline_demo")) return "manual_pr_creation_review";
  if (layerReady(layers, "shadow_patch_execution")) return "prepare_pr_creation_intent";
  if (layerReady(layers, "patch_validation")) return "run_shadow_patch_execution";
  if (layerReady(layers, "patch_generation")) return "run_patch_validation";
  if (layerReady(layers, "approval_gate")) return "run_patch_generation";
  return "collect_more_evidence";
}

function layerReady(layers: readonly GovernanceLayerSummary[], layerId: string): boolean {
  return layers.some((layer) => layer.layer_id === layerId && layer.status === "ready");
}

function nextStepForStatus(status: GovernanceLayerStatus): string {
  if (status === "blocked" || status === "needs_review") return "request_human_review";
  if (status === "missing" || status === "not_available") return "collect_more_evidence";
  return "continue_supervised_pipeline";
}

function safetyPosture(): GovernanceDashboardJson["safety_posture"] {
  return {
    github_mutation: false,
    branch_creation: false,
    commit_creation: false,
    push: false,
    pr_creation: false,
    scheduler_mutation: false,
    apply_automerge_mutation: false,
  };
}

function sum(
  layers: readonly GovernanceLayerSummary[],
  key: "observed" | "proposals" | "approvals" | "simulations" | "intents" | "blocks",
): number {
  return layers.reduce((total, layer) => total + layer[key], 0);
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function arrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}
