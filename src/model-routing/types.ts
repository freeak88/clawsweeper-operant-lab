export type ModelRoutingTier = "trivial" | "standard" | "complex" | "high-risk";
export type ModelRoutingReasoningEffort = "low" | "medium" | "high";

export interface ModelRoutingInput {
  priorityScore?: number | undefined;
  priorityBand?: string | undefined;
  labels?: readonly string[] | undefined;
  itemType?: "issue" | "pull_request" | string | undefined;
  touchedFilePaths?: readonly string[] | undefined;
  reviewMemoryPatterns?: readonly string[] | undefined;
  repairMarkers?: readonly string[] | undefined;
  conflictTypes?: readonly string[] | undefined;
  checkFailureMarkers?: readonly string[] | undefined;
}

export interface ModelRoutingRecommendation {
  routing_tier: ModelRoutingTier;
  recommended_model: string;
  recommended_reasoning_effort: ModelRoutingReasoningEffort;
  routing_reasons: string[];
}
