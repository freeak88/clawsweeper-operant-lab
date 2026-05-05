import type { AdaptiveSchedulerInput, AdaptiveSchedulerRecommendation } from "./types.js";

const DEFAULT_HARD_SHARD_CAP = 80;

export function recommendAdaptiveScheduler(
  input: AdaptiveSchedulerInput,
): AdaptiveSchedulerRecommendation {
  const hardCap = positiveInteger(input.hardShardCap) ?? DEFAULT_HARD_SHARD_CAP;
  const currentShardCount = clampInteger(input.currentShardCount, 1, hardCap);
  const currentMinActiveShards = clampInteger(input.currentMinActiveShards, 0, hardCap);
  const currentBatchSize = Math.max(1, Math.floor(input.currentBatchSize || 1));
  const plannedCapacity = nonNegative(input.plannedCapacity);
  const dueBacklog = nonNegative(input.dueBacklog);
  const activeCodexTarget = nonNegative(input.activeCodexTarget);
  const failedShardCount = nonNegative(input.failedShardCount);
  const reasons: string[] = [
    `lane ${input.lane || "unknown"}`,
    `target repo ${input.targetRepo || "unknown"}`,
  ];

  if (failedShardCount >= Math.max(2, Math.ceil(currentShardCount * 0.1))) {
    reasons.push(`failed shard count ${failedShardCount}`);
    reasons.push("failure investigation takes precedence over capacity changes");
    return recommendation(input, currentShardCount, currentMinActiveShards, currentBatchSize, {
      recommendation: "investigate_failures",
      confidence: 0.88,
      reasons,
      hardCap,
    });
  }

  if (isSaturated(input.capacityReason) && dueBacklog >= Math.max(1, plannedCapacity)) {
    const recommendedShardCount = clampInteger(
      Math.max(currentShardCount + 1, Math.ceil(currentShardCount * 1.2)),
      1,
      hardCap,
    );
    const recommendedMinActiveShards = clampInteger(
      Math.max(currentMinActiveShards, Math.ceil(recommendedShardCount / 2)),
      0,
      recommendedShardCount,
    );
    reasons.push(`saturated capacity reason: ${input.capacityReason}`);
    reasons.push(`due backlog ${dueBacklog} >= planned capacity ${plannedCapacity}`);
    return recommendation(
      input,
      recommendedShardCount,
      recommendedMinActiveShards,
      currentBatchSize,
      {
        recommendation: recommendedShardCount > currentShardCount ? "increase_capacity" : "hold",
        confidence: recommendedShardCount > currentShardCount ? 0.82 : 0.62,
        reasons,
        hardCap,
      },
    );
  }

  if (dueBacklog === 0 && !hasOldBacklog(input.oldestUnreviewedAt)) {
    reasons.push("no due backlog");
    reasons.push("no old unreviewed backlog signal");
    return recommendation(input, currentShardCount, currentMinActiveShards, currentBatchSize, {
      recommendation: "idle",
      confidence: 0.78,
      reasons,
      hardCap,
    });
  }

  if (
    plannedCapacity > 0 &&
    dueBacklog <= Math.max(1, Math.floor(plannedCapacity * 0.15)) &&
    activeCodexTarget <= Math.max(1, Math.floor(currentShardCount * 0.25))
  ) {
    const clearlySafe =
      dueBacklog === 0 && activeCodexTarget === 0 && !hasOldBacklog(input.oldestUnreviewedAt);
    reasons.push(`low due backlog ${dueBacklog} of capacity ${plannedCapacity}`);
    reasons.push(
      `active Codex target ${activeCodexTarget} below current shard count ${currentShardCount}`,
    );
    if (clearlySafe) {
      return recommendation(
        input,
        Math.max(1, currentShardCount - 1),
        Math.max(0, Math.min(currentMinActiveShards, currentShardCount - 1)),
        currentBatchSize,
        {
          recommendation: "decrease_capacity",
          confidence: 0.64,
          reasons,
          hardCap,
        },
      );
    }
    reasons.push("holding because backlog is low but not clearly idle");
    return recommendation(input, currentShardCount, currentMinActiveShards, currentBatchSize, {
      recommendation: "hold",
      confidence: 0.58,
      reasons,
      hardCap,
    });
  }

  reasons.push("no strong adaptive scheduler signal");
  return recommendation(input, currentShardCount, currentMinActiveShards, currentBatchSize, {
    recommendation: "hold",
    confidence: 0.5,
    reasons,
    hardCap,
  });
}

function recommendation(
  input: AdaptiveSchedulerInput,
  shardCount: number,
  minActiveShards: number,
  batchSize: number,
  options: {
    recommendation: AdaptiveSchedulerRecommendation["recommendation"];
    confidence: number;
    reasons: string[];
    hardCap: number;
  },
): AdaptiveSchedulerRecommendation {
  const recommendedShardCount = clampInteger(shardCount, 1, options.hardCap);
  return {
    recommended_shard_count: recommendedShardCount,
    recommended_min_active_shards: clampInteger(minActiveShards, 0, recommendedShardCount),
    recommended_batch_size: Math.max(1, Math.floor(batchSize || input.currentBatchSize || 1)),
    recommendation: options.recommendation,
    confidence: roundConfidence(options.confidence),
    reasons: sortedUnique(options.reasons),
  };
}

function isSaturated(reason: string | undefined): boolean {
  return Boolean(reason?.toLowerCase().includes("saturated"));
}

function hasOldBacklog(oldestUnreviewedAt: string | undefined): boolean {
  if (!oldestUnreviewedAt) return false;
  const parsed = new Date(oldestUnreviewedAt);
  if (Number.isNaN(parsed.valueOf())) return true;
  return Date.now() - parsed.valueOf() > 7 * 86_400_000;
}

function positiveInteger(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) return undefined;
  return Math.floor(value);
}

function nonNegative(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function clampInteger(value: number, min: number, max: number): number {
  const integer = Number.isFinite(value) ? Math.floor(value) : min;
  return Math.max(min, Math.min(max, integer));
}

function roundConfidence(value: number): number {
  return Number(Math.max(0, Math.min(1, value)).toFixed(2));
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}
