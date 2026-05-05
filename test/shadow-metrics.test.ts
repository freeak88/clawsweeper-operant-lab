import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { analyzeShadowReports, runShadowMetrics } from "../dist/shadow-metrics/index.js";
import type { ShadowRuntimeReport } from "../dist/shadow-runtime/index.js";

const generatedAt = "2026-05-05T00:00:00.000Z";

function match(
  policyId: string,
  itemNumber: number,
  confidenceScore: number,
  options: {
    action?: "annotate_only" | "propose_close" | "propose_repair" | "propose_automerge";
    band?: "low" | "medium" | "high" | "blocked";
    risks?: string[];
  } = {},
) {
  return {
    policy_id: policyId,
    item_number: itemNumber,
    matched: true,
    would_action: options.action ?? "propose_close",
    dry_run_only: true,
    confidence_score: confidenceScore,
    confidence_band: options.band ?? "high",
    risks: options.risks ?? [],
  };
}

function report(matches: ShadowRuntimeReport["matches"]): ShadowRuntimeReport {
  return {
    schema_version: 1,
    generated_at: generatedAt,
    target_repo: "openclaw/openclaw",
    summary: {
      policy_count: new Set(matches.map((item) => item.policy_id)).size,
      item_count: matches.length,
      match_count: matches.length,
      would_action_counts: {},
    },
    matches,
  };
}

test("shadow metrics aggregates multiple reports", () => {
  const metrics = analyzeShadowReports({
    generatedAt,
    reports: [
      report([match("safe-close", 1, 0.9)]),
      report([
        match("safe-close", 2, 0.85),
        match("annotate", 3, 0.7, { action: "annotate_only" }),
      ]),
    ],
  });

  assert.equal(metrics.policy_count, 2);
  assert.equal(metrics.total_matches, 3);
  assert.deepEqual(metrics.matches_by_policy, { annotate: 1, "safe-close": 2 });
  assert.deepEqual(metrics.would_action_counts, { annotate_only: 1, propose_close: 2 });
});

test("shadow metrics computes average confidence", () => {
  const metrics = analyzeShadowReports({
    generatedAt,
    reports: [report([match("safe-close", 1, 0.9), match("safe-close", 2, 0.6)])],
  });

  assert.equal(metrics.average_confidence_by_policy["safe-close"], 0.75);
});

test("shadow metrics counts risks and blocked matches", () => {
  const metrics = analyzeShadowReports({
    generatedAt,
    reports: [
      report([
        match("safe-close", 1, 0.9, { risks: ["dry-run only"] }),
        match("safe-close", 2, 0, { band: "blocked", risks: ["failed required check"] }),
      ]),
    ],
  });

  assert.equal(metrics.blocked_count, 1);
  assert.equal(metrics.risk_count_by_policy["safe-close"], 2);
});

test("shadow metrics rejects low-observation policies", () => {
  const metrics = analyzeShadowReports({
    generatedAt,
    reports: [report([match("safe-close", 1, 0.95)])],
  });

  assert.equal(metrics.policies[0]?.candidate_for_guarded_execution, false);
  assert.match(metrics.policies[0]?.candidate_reason ?? "", /insufficient observations/);
});

test("shadow metrics rejects policies with blocked matches", () => {
  const metrics = analyzeShadowReports({
    generatedAt,
    reports: [
      report([
        match("safe-close", 1, 0.95),
        match("safe-close", 2, 0.95),
        match("safe-close", 3, 0.95),
        match("safe-close", 4, 0.95),
        match("safe-close", 5, 0, { band: "blocked" }),
      ]),
    ],
  });

  assert.equal(metrics.policies[0]?.candidate_for_guarded_execution, false);
  assert.match(metrics.policies[0]?.candidate_reason ?? "", /blocked matches present/);
});

test("shadow metrics marks safe high-confidence policies as candidates", () => {
  const metrics = analyzeShadowReports({
    generatedAt,
    reports: [
      report([
        match("safe-close", 1, 0.95),
        match("safe-close", 2, 0.9),
        match("safe-close", 3, 0.9),
        match("safe-close", 4, 0.85),
        match("safe-close", 5, 0.85),
      ]),
    ],
  });

  assert.equal(metrics.policies[0]?.candidate_for_guarded_execution, true);
  assert.equal(metrics.policies[0]?.candidate_reason, "meets conservative shadow criteria");
});

test("shadow metrics output is deterministic with fixed clock", () => {
  const first = analyzeShadowReports({
    generatedAt,
    reports: [report([match("b", 2, 0.8), match("a", 1, 0.9)])],
  });
  const second = analyzeShadowReports({
    generatedAt,
    reports: [report([match("a", 1, 0.9), match("b", 2, 0.8)])],
  });

  assert.deepEqual(first, second);
});

test("shadow metrics malformed reports are skipped with warnings", () => {
  const root = mkdtempSync(join(tmpdir(), "clawsweeper-shadow-metrics-"));
  try {
    const reportsDir = join(root, "reports");
    mkdirSync(reportsDir, { recursive: true });
    writeFileSync(
      join(reportsDir, "good.json"),
      `${JSON.stringify(report([match("safe-close", 1, 0.9)]))}\n`,
    );
    writeFileSync(join(reportsDir, "bad.json"), "{ nope");
    writeFileSync(join(reportsDir, "wrong.json"), `${JSON.stringify({ schema_version: 1 })}\n`);

    const result = runShadowMetrics({
      reportsDir,
      outputRoot: join(root, "out"),
      generatedAt,
    });

    assert.equal(result.ok, true);
    assert.equal(result.report?.total_matches, 1);
    assert.equal(result.warnings.length, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
