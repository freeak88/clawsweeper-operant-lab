import assert from "node:assert/strict";
import test from "node:test";

import { recommendAdaptiveScheduler } from "../dist/adaptive-scheduler/index.js";

const baseInput = {
  targetRepo: "openclaw/openclaw",
  lane: "normal_review",
  currentShardCount: 50,
  currentMinActiveShards: 20,
  currentBatchSize: 1,
  hardShardCap: 80,
};

test("adaptive scheduler recommends increase_capacity for saturated queue", () => {
  const result = recommendAdaptiveScheduler({
    ...baseInput,
    plannedCapacity: 50,
    dueBacklog: 80,
    activeCodexTarget: 50,
    capacityReason: "saturated: due backlog filled planned capacity",
  });

  assert.equal(result.recommendation, "increase_capacity");
  assert.equal(result.recommended_shard_count, 60);
});

test("adaptive scheduler recommends investigate_failures before increasing", () => {
  const result = recommendAdaptiveScheduler({
    ...baseInput,
    plannedCapacity: 50,
    dueBacklog: 80,
    activeCodexTarget: 50,
    failedShardCount: 8,
    capacityReason: "saturated: due backlog filled planned capacity",
  });

  assert.equal(result.recommendation, "investigate_failures");
  assert.equal(result.recommended_shard_count, 50);
});

test("adaptive scheduler recommends idle for no due candidates and no old backlog", () => {
  const result = recommendAdaptiveScheduler({
    ...baseInput,
    plannedCapacity: 50,
    dueBacklog: 0,
    activeCodexTarget: 0,
  });

  assert.equal(result.recommendation, "idle");
});

test("adaptive scheduler holds on low backlog unless clearly safe", () => {
  const result = recommendAdaptiveScheduler({
    ...baseInput,
    plannedCapacity: 50,
    dueBacklog: 4,
    activeCodexTarget: 5,
  });

  assert.equal(result.recommendation, "hold");
  assert.equal(result.recommended_shard_count, 50);
});

test("adaptive scheduler recommendations clamp to hard cap", () => {
  const result = recommendAdaptiveScheduler({
    ...baseInput,
    currentShardCount: 79,
    currentMinActiveShards: 70,
    plannedCapacity: 79,
    dueBacklog: 120,
    capacityReason: "saturated: due backlog filled planned capacity",
    hardShardCap: 80,
  });

  assert.equal(result.recommended_shard_count, 80);
  assert.equal(result.recommended_min_active_shards, 70);
});

test("adaptive scheduler output is deterministic", () => {
  const input = {
    ...baseInput,
    plannedCapacity: 50,
    dueBacklog: 80,
    activeCodexTarget: 50,
    capacityReason: "saturated: due backlog filled planned capacity",
  };

  assert.deepEqual(recommendAdaptiveScheduler(input), recommendAdaptiveScheduler(input));
});
