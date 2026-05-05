import assert from "node:assert/strict";
import test from "node:test";

import { classifyModelRouting } from "../dist/model-routing/index.js";

test("model routing classifier returns trivial for low-risk simple issue", () => {
  const result = classifyModelRouting({
    itemType: "issue",
    labels: ["question"],
    priorityScore: 0.1,
    priorityBand: "low",
  });

  assert.equal(result.routing_tier, "trivial");
  assert.equal(result.recommended_reasoning_effort, "low");
});

test("model routing classifier returns standard for normal review surface", () => {
  const result = classifyModelRouting({
    itemType: "pull_request",
    labels: ["bug"],
    priorityScore: 0.45,
    priorityBand: "normal",
  });

  assert.equal(result.routing_tier, "standard");
  assert.equal(result.recommended_reasoning_effort, "medium");
});

test("model routing classifier returns complex for broad PR config changes", () => {
  const result = classifyModelRouting({
    itemType: "pull_request",
    labels: ["bug"],
    touchedFilePaths: [
      "src/a.ts",
      "src/b.ts",
      "src/c.ts",
      "src/d.ts",
      "src/e.ts",
      "src/f.ts",
      "src/g.ts",
      "package.json",
    ],
  });

  assert.equal(result.routing_tier, "complex");
  assert.ok(result.routing_reasons.includes("broad change touches 8 files"));
});

test("model routing classifier returns high-risk for workflow security paths", () => {
  const result = classifyModelRouting({
    itemType: "pull_request",
    labels: ["security"],
    priorityBand: "high",
    touchedFilePaths: [".github/workflows/sweep.yml", "src/auth/session.ts"],
  });

  assert.equal(result.routing_tier, "high-risk");
  assert.equal(result.recommended_reasoning_effort, "high");
  assert.ok(result.routing_reasons.includes("high-risk label security"));
});

test("model routing classifier tolerates missing fields", () => {
  assert.doesNotThrow(() => classifyModelRouting({}));
  const result = classifyModelRouting({});

  assert.equal(result.routing_tier, "trivial");
  assert.ok(result.routing_reasons.includes("missing item type"));
});

test("model routing classifier output is deterministic", () => {
  const input = {
    itemType: "pull_request",
    labels: ["bug", "security"],
    touchedFilePaths: ["src/auth/session.ts", "package.json"],
    repairMarkers: ["queue_fix_pr"],
    conflictTypes: ["package-lock"],
    checkFailureMarkers: ["test-failed"],
  };

  assert.deepEqual(classifyModelRouting(input), classifyModelRouting(input));
});
