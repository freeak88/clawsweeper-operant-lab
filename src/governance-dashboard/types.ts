export const GOVERNANCE_PRINCIPLE = "Evidence → Proposal → Approval → Simulation → Intent";

export type GovernanceLayerStatus =
  | "available"
  | "missing"
  | "not_available"
  | "blocked"
  | "needs_review"
  | "ready";

export type GovernanceLayerStage =
  | "evidence"
  | "proposal"
  | "approval"
  | "simulation"
  | "intent"
  | "safety";

export interface GovernanceLayerSummary {
  layer_id: string;
  name: string;
  stage: GovernanceLayerStage;
  status: GovernanceLayerStatus;
  artifact_path: string | null;
  observed: number;
  proposals: number;
  approvals: number;
  simulations: number;
  intents: number;
  blocks: number;
  answers: {
    observed: string;
    proposed: string;
    approved: string;
    simulation: string;
    intent: string;
    blocks: string;
    next_safe_step: string;
  };
}

export interface GovernanceDashboardJson {
  schema_version: 1;
  generated_at: string;
  principle: typeof GOVERNANCE_PRINCIPLE;
  summary: {
    observed: number;
    proposals: number;
    approvals: number;
    simulations: number;
    intents: number;
    blocks: number;
    next_safe_action: string;
  };
  layers: GovernanceLayerSummary[];
  safety_posture: {
    github_mutation: false;
    branch_creation: false;
    commit_creation: false;
    push: false;
    pr_creation: false;
    scheduler_mutation: false;
    apply_automerge_mutation: false;
  };
}

export interface GovernanceArtifact {
  layer_id: string;
  name: string;
  stage: GovernanceLayerStage;
  artifact_path: string;
  data: Record<string, unknown>;
}

export interface GovernanceCollection {
  input_root: string;
  artifacts: GovernanceArtifact[];
}

export interface GovernanceDashboardRunOptions {
  inputRoot: string;
  outputRoot: string;
  generatedAt?: string | undefined;
}

export interface GovernanceDashboardRunResult {
  dashboard: GovernanceDashboardJson;
  markdown: string;
  jsonPath: string;
  markdownPath: string;
}
