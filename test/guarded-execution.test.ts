import assert from "node:assert/strict";
import test from "node:test";

import { evaluateGuardedExecution } from "../dist/guarded-execution/index.js";
import type { GuardedExecutionInput } from "../dist/guarded-execution/index.js";

const baseInput: GuardedExecutionInput = {
  policy: {
    policy_id: "safe-annotation-policy",
    status: "approved",
    action: { type: "annotate_only", mode: "dry_run_only" },
  },
  metrics: {
    policy_id: "safe-annotation-policy",
    candidate_for_guarded_execution: true,
    blocked_count: 0,
    risk_count_by_policy: 0,
    candidate_reason: "meets conservative shadow criteria",
  },
  confidence: {
    confidence_score: 0.95,
    confidence_band: "high",
    confidence_reasons: ["stable historical matches"],
    blocking_risks: [],
  },
  item_number: 42,
  dry_run: false,
  enabled: true,
  generated_at: "2026-05-05T00:00:00.000Z",
};

test("guarded execution rejects policies that are not candidates", () => {
  const decision = evaluateGuardedExecution({
    ...baseInput,
    metrics: { ...baseInput.metrics, candidate_for_guarded_execution: false },
  });

  assert.equal(decision.executed, false);
  assert.match(decision.reason, /not a guarded candidate/);
});

test("guarded execution rejects low confidence", () => {
  const decision = evaluateGuardedExecution({
    ...baseInput,
    confidence: { ...baseInput.confidence, confidence_score: 0.89 },
  });

  assert.equal(decision.executed, false);
  assert.match(decision.reason, /confidence_score below 0.9/);
});

test("guarded execution rejects blocked and risky metrics", () => {
  const blocked = evaluateGuardedExecution({
    ...baseInput,
    metrics: { ...baseInput.metrics, blocked_count: 1 },
  });
  const risky = evaluateGuardedExecution({
    ...baseInput,
    metrics: { ...baseInput.metrics, risk_count_by_policy: 1 },
  });

  assert.equal(blocked.executed, false);
  assert.match(blocked.reason, /blocked_count must be 0/);
  assert.equal(risky.executed, false);
  assert.match(risky.reason, /risk_count_by_policy must be 0/);
});

test("guarded execution allows an enabled safe annotation case", () => {
  const decision = evaluateGuardedExecution(baseInput);

  assert.equal(decision.executed, true);
  assert.equal(decision.action, "annotate_only");
  assert.equal(decision.policy_id, "safe-annotation-policy");
  assert.equal(decision.item_number, 42);
  assert.ok(decision.rollback_hint.includes("no external state was changed"));
});

test("guarded execution supports suggest_comment as a safe local action", () => {
  const decision = evaluateGuardedExecution({
    ...baseInput,
    policy: { ...baseInput.policy, action: { type: "suggest_comment", mode: "dry_run_only" } },
  });

  assert.equal(decision.executed, true);
  assert.equal(decision.action, "suggest_comment");
});

test("guarded execution dry_run prevents execution", () => {
  const decision = evaluateGuardedExecution({ ...baseInput, dry_run: true });

  assert.equal(decision.executed, false);
  assert.equal(decision.action, "none");
  assert.match(decision.reason, /dry_run=true/);
});

test("guarded execution is disabled unless explicitly enabled", () => {
  const decision = evaluateGuardedExecution({ ...baseInput, enabled: false });

  assert.equal(decision.executed, false);
  assert.match(decision.reason, /flag/);
});

test("guarded execution rejects unsafe action types", () => {
  const decision = evaluateGuardedExecution({
    ...baseInput,
    policy: { ...baseInput.policy, action: { type: "propose_close", mode: "dry_run_only" } },
  });

  assert.equal(decision.executed, false);
  assert.match(decision.reason, /not allowed/);
});

test("guarded execution output is deterministic with fixed clock", () => {
  const first = evaluateGuardedExecution(baseInput);
  const second = evaluateGuardedExecution({
    ...baseInput,
    confidence: {
      ...baseInput.confidence,
      confidence_reasons: [...(baseInput.confidence.confidence_reasons ?? [])].reverse(),
    },
  });

  assert.deepEqual(first, second);
});
