export type PriorityItemType = "issue" | "pull_request";
export type PriorityBand = "low" | "normal" | "high" | "critical";
export type AuthorAssociation =
  | "OWNER"
  | "MEMBER"
  | "COLLABORATOR"
  | "CONTRIBUTOR"
  | "FIRST_TIME_CONTRIBUTOR"
  | "FIRST_TIMER"
  | "NONE"
  | "MANNEQUIN"
  | string;

export interface PriorityRiskPathSignal {
  path: string;
  weight?: number | undefined;
  reason?: string | undefined;
}

export interface PriorityItemInput {
  repo?: string | undefined;
  repoWeight?: number | undefined;
  labels?: readonly string[] | undefined;
  labelWeights?: Readonly<Record<string, number>> | undefined;
  itemType?: PriorityItemType | undefined;
  createdAt?: string | Date | undefined;
  updatedAt?: string | Date | undefined;
  staleAt?: string | Date | undefined;
  authorAssociation?: AuthorAssociation | undefined;
  riskPathSignals?: readonly PriorityRiskPathSignal[] | undefined;
  now?: string | Date | undefined;
}

export interface PriorityScoreResult {
  priority_score: number;
  priority_band: PriorityBand;
  priority_reasons: string[];
}
