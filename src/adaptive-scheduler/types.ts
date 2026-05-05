export type AdaptiveSchedulerDecision =
  | "hold"
  | "increase_capacity"
  | "decrease_capacity"
  | "investigate_failures"
  | "idle";

export interface AdaptiveSchedulerInput {
  targetRepo: string;
  lane: string;
  plannedCount?: number | undefined;
  plannedCapacity?: number | undefined;
  activeCodexTarget?: number | undefined;
  dueBacklog?: number | undefined;
  oldestUnreviewedAt?: string | undefined;
  capacityReason?: string | undefined;
  failedShardCount?: number | undefined;
  reviewDurationMs?: number | undefined;
  currentShardCount: number;
  currentMinActiveShards: number;
  currentBatchSize: number;
  hardShardCap?: number | undefined;
}

export interface AdaptiveSchedulerRecommendation {
  recommended_shard_count: number;
  recommended_min_active_shards: number;
  recommended_batch_size: number;
  recommendation: AdaptiveSchedulerDecision;
  confidence: number;
  reasons: string[];
}

export interface AdaptiveSchedulerRecommendationOutput {
  adaptive_scheduler_recommendation: AdaptiveSchedulerRecommendation;
}
