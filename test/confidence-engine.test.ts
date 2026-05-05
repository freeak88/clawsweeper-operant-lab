import assert from "node:assert/strict";
import test from "node:test";

import { scoreConfidence } from "../dist/confidence-engine/index.js";

test("confidence engine scores green safe-close proposal high", () => {
  const result = scoreConfidence({
    confidenceTarget: "safe_close",
    reviewVerdict: "close",
    safeCloseReason: "implemented_on_main",
    snapshotDriftStatus: "stable",
    authorAssociation: "MEMBER",
    reviewMemoryPatterns: ["successfully closed prior duplicate"],
    policyRfcMatches: ["safe close implemented on main"],
  });

  assert.equal(result.confidence_band, "high");
  assert.equal(result.suggested_action, "eligible_for_policy_candidate");
});

test("confidence engine blocks safe-close confidence on snapshot drift", () => {
  const result = scoreConfidence({
    confidenceTarget: "safe_close",
    reviewVerdict: "close",
    safeCloseReason: "implemented_on_main",
    snapshotDriftStatus: "stale_drift",
    authorAssociation: "MEMBER",
  });

  assert.equal(result.confidence_band, "blocked");
  assert.ok(result.blocking_risks.includes("snapshot drift stale_drift"));
});

test("confidence engine blocks automerge readiness on terminal required-check failure", () => {
  const result = scoreConfidence({
    confidenceTarget: "automerge_readiness",
    reviewVerdict: "approved",
    requiredCheckStatus: "failure",
    reviewMemoryPatterns: ["successfully merged prior repair"],
  });

  assert.equal(result.confidence_band, "blocked");
  assert.equal(result.suggested_action, "blocked");
});

test("confidence engine tolerates missing fields conservatively", () => {
  assert.doesNotThrow(() => scoreConfidence({ confidenceTarget: "review_verdict" }));
  const result = scoreConfidence({ confidenceTarget: "review_verdict" });

  assert.equal(result.confidence_band, "low");
  assert.equal(result.suggested_action, "observe");
});

test("confidence engine sensitive paths reduce confidence", () => {
  const plain = scoreConfidence({
    confidenceTarget: "repair_acceptance",
    reviewVerdict: "complete",
    snapshotDriftStatus: "stable",
    authorAssociation: "MEMBER",
  });
  const sensitive = scoreConfidence({
    confidenceTarget: "repair_acceptance",
    reviewVerdict: "complete",
    snapshotDriftStatus: "stable",
    authorAssociation: "MEMBER",
    touchedFilePaths: [".github/workflows/sweep.yml", "src/auth/session.ts"],
    labels: ["security"],
  });

  assert.ok(sensitive.confidence_score < plain.confidence_score);
});

test("confidence engine memory can raise confidence but cannot override blocking risks", () => {
  const result = scoreConfidence({
    confidenceTarget: "automerge_readiness",
    reviewVerdict: "approved",
    requiredCheckStatus: "failed",
    reviewMemoryPatterns: ["successfully merged prior repair"],
    authorAssociation: "OWNER",
  });

  assert.equal(result.confidence_band, "blocked");
  assert.equal(result.confidence_score, 0);
});

test("confidence engine output is deterministic", () => {
  const input = {
    confidenceTarget: "repair_acceptance" as const,
    reviewVerdict: "complete",
    snapshotDriftStatus: "stable",
    authorAssociation: "MEMBER",
    repairMarkers: ["queue_fix_pr"],
    conflictTypes: ["package-lock"],
  };

  assert.deepEqual(scoreConfidence(input), scoreConfidence(input));
});
