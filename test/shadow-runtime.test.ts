import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildShadowRuntimeReport, runShadowRuntime } from "../dist/shadow-runtime/index.js";
import type { PolicyDslRule } from "../dist/policy-dsl/index.js";
import type { ReviewMemoryIndex } from "../dist/review-memory/index.js";

const approvedPolicy = {
  policy_id: "auto-resolve-changelog-conflict",
  status: "approved",
  conditions: [
    { field: "conflict_types", op: "includes", value: "changelog" },
    { field: "labels", op: "not_includes", value: "security" },
  ],
  action: { type: "propose_repair", mode: "dry_run_only" },
};

const closePolicy = {
  policy_id: "safe-close-implemented",
  status: "approved",
  conditions: [{ field: "safe_close_reasons", op: "includes", value: "implemented_on_main" }],
  action: { type: "propose_close", mode: "dry_run_only" },
};

const memory: ReviewMemoryIndex = {
  schema_version: 1,
  generated_at: "2026-05-05T00:00:00.000Z",
  target_repo: "openclaw/openclaw",
  summary: { record_count: 2, item_count: 2, pattern_count: 0 },
  patterns: [],
  items: [
    {
      item_number: 2,
      target_repo: "openclaw/openclaw",
      labels: ["security"],
      verdicts: ["needs-changes"],
      repair_markers: [],
      conflict_types: ["changelog"],
      safe_close_reasons: [],
      automerge_causes: [],
      policy_rfc_refs: [],
    },
    {
      item_number: 1,
      target_repo: "openclaw/openclaw",
      labels: ["bug"],
      verdicts: ["close"],
      repair_markers: ["validation-fix"],
      conflict_types: ["changelog"],
      safe_close_reasons: ["implemented_on_main"],
      automerge_causes: [],
      policy_rfc_refs: ["auto-resolve-changelog-conflict"],
    },
  ],
};

test("shadow runtime evaluates approved policies", () => {
  const report = buildShadowRuntimeReport({
    policies: [approvedPolicy as PolicyDslRule],
    memory,
    generatedAt: "2026-05-05T00:00:00.000Z",
  });

  assert.equal(report.summary.policy_count, 1);
  assert.equal(report.summary.item_count, 2);
  assert.equal(report.summary.match_count, 1);
  assert.equal(report.matches[0]?.policy_id, approvedPolicy.policy_id);
  assert.equal(report.matches[0]?.item_number, 1);
});

test("shadow runtime skips draft candidate and rejected policies", () => {
  const root = mkdtempSync(join(tmpdir(), "clawsweeper-shadow-runtime-"));
  try {
    const policiesDir = join(root, "policies");
    mkdirSync(policiesDir, { recursive: true });
    writeFileSync(join(root, "memory.json"), `${JSON.stringify(memory)}\n`);
    writeFileSync(join(policiesDir, "approved.json"), `${JSON.stringify(approvedPolicy)}\n`);
    writeFileSync(
      join(policiesDir, "candidate.json"),
      `${JSON.stringify({ ...approvedPolicy, policy_id: "candidate-policy", status: "candidate" })}\n`,
    );
    writeFileSync(
      join(policiesDir, "rejected.json"),
      `${JSON.stringify({ ...approvedPolicy, policy_id: "rejected-policy", status: "rejected" })}\n`,
    );

    const result = runShadowRuntime({
      policiesDir,
      memoryPath: join(root, "memory.json"),
      outputRoot: join(root, "out"),
      generatedAt: "2026-05-05T00:00:00.000Z",
    });

    assert.equal(result.ok, true);
    assert.equal(result.report?.summary.policy_count, 1);
    assert.equal(result.warnings.length, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("shadow runtime reports matches and action counts correctly", () => {
  const report = buildShadowRuntimeReport({
    policies: [approvedPolicy as PolicyDslRule, closePolicy as PolicyDslRule],
    memory,
    generatedAt: "2026-05-05T00:00:00.000Z",
  });

  assert.equal(report.summary.match_count, 2);
  assert.deepEqual(report.summary.would_action_counts, {
    propose_close: 1,
    propose_repair: 1,
  });
  assert.deepEqual(
    report.matches.map((match) => [match.policy_id, match.would_action]),
    [
      ["auto-resolve-changelog-conflict", "propose_repair"],
      ["safe-close-implemented", "propose_close"],
    ],
  );
});

test("shadow runtime malformed policies do not crash run", () => {
  const root = mkdtempSync(join(tmpdir(), "clawsweeper-shadow-runtime-"));
  try {
    const policiesDir = join(root, "policies");
    mkdirSync(policiesDir, { recursive: true });
    writeFileSync(join(root, "memory.json"), `${JSON.stringify(memory)}\n`);
    writeFileSync(join(policiesDir, "approved.json"), `${JSON.stringify(approvedPolicy)}\n`);
    writeFileSync(join(policiesDir, "malformed.json"), "{ not json");

    const result = runShadowRuntime({
      policiesDir,
      memoryPath: join(root, "memory.json"),
      outputRoot: join(root, "out"),
      generatedAt: "2026-05-05T00:00:00.000Z",
    });

    assert.equal(result.ok, true);
    assert.equal(result.report?.summary.policy_count, 1);
    assert.equal(result.warnings.length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("shadow runtime has no execution path", () => {
  const report = buildShadowRuntimeReport({
    policies: [approvedPolicy as PolicyDslRule],
    memory,
    generatedAt: "2026-05-05T00:00:00.000Z",
  });

  assert.equal(report.matches[0]?.dry_run_only, true);
  assert.ok(report.matches[0]?.risks.includes("dry-run only; no action executed"));
});

test("shadow runtime output is deterministic with fixed clock", () => {
  const first = buildShadowRuntimeReport({
    policies: [closePolicy as PolicyDslRule, approvedPolicy as PolicyDslRule],
    memory,
    generatedAt: "2026-05-05T00:00:00.000Z",
  });
  const second = buildShadowRuntimeReport({
    policies: [approvedPolicy as PolicyDslRule, closePolicy as PolicyDslRule],
    memory: { ...memory, items: [...memory.items].reverse() },
    generatedAt: "2026-05-05T00:00:00.000Z",
  });

  assert.deepEqual(first, second);
});
