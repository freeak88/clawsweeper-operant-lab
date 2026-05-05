export type ConfidenceTarget =
  | "safe_close"
  | "repair_acceptance"
  | "automerge_readiness"
  | "review_verdict";

export type ConfidenceBand = "low" | "medium" | "high" | "blocked";
export type ConfidenceSuggestedAction =
  | "observe"
  | "require_human_review"
  | "eligible_for_policy_candidate"
  | "blocked";

export interface ConfidenceInput {
  confidenceTarget: ConfidenceTarget;
  reviewVerdict?: string | undefined;
  safeCloseReason?: string | undefined;
  snapshotDriftStatus?: string | undefined;
  labels?: readonly string[] | undefined;
  authorAssociation?: string | undefined;
  requiredCheckStatus?: string | undefined;
  checkFailures?: readonly string[] | undefined;
  repairMarkers?: readonly string[] | undefined;
  conflictTypes?: readonly string[] | undefined;
  priorityBand?: string | undefined;
  modelRoutingTier?: string | undefined;
  reviewMemoryPatterns?: readonly string[] | undefined;
  policyRfcMatches?: readonly string[] | undefined;
  touchedFilePaths?: readonly string[] | undefined;
}

export interface ConfidenceScoreResult {
  confidence_target: ConfidenceTarget;
  confidence_score: number;
  confidence_band: ConfidenceBand;
  suggested_action: ConfidenceSuggestedAction;
  confidence_reasons: string[];
  blocking_risks: string[];
}
