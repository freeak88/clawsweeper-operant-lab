import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  dryRunPolicyDsl,
  evaluatePolicyDsl,
  parsePolicyDsl,
  runPolicyDslDryRunFromFile,
} from "../dist/policy-dsl/index.js";

const policyJson = {
  policy_id: "auto-resolve-changelog-conflict",
  status: "approved",
  conditions: [
    { field: "conflict_types", op: "includes", value: "changelog" },
    { field: "labels", op: "not_includes", value: "security" },
  ],
  action: {
    type: "propose_repair",
    mode: "dry_run_only",
  },
};

const matchingItem = {
  item_number: 42,
  target_repo: "openclaw/openclaw",
  labels: ["bug"],
  verdicts: ["needs-changes"],
  repair_markers: [],
  conflict_types: ["changelog"],
  safe_close_reasons: [],
  automerge_causes: [],
  policy_rfc_refs: [],
};

test("policy DSL parser accepts valid approved dry-run rules", () => {
  const policy = parsePolicyDsl(policyJson);
  assert.equal(policy.policy_id, "auto-resolve-changelog-conflict");
  assert.equal(policy.status, "approved");
  assert.equal(policy.action.type, "propose_repair");
  assert.equal(policy.action.mode, "dry_run_only");
  assert.equal(policy.conditions.length, 2);
});

test("policy DSL parser rejects invalid rules safely", () => {
  assert.throws(
    () => parsePolicyDsl({ ...policyJson, status: "candidate" }),
    /status must be approved/,
  );
  assert.throws(
    () =>
      parsePolicyDsl({
        ...policyJson,
        conditions: [{ field: "labels", op: "contains", value: "bug" }],
      }),
    /Unsupported policy condition operator/,
  );
});

test("policy DSL evaluator returns matched true for matching item", () => {
  const result = evaluatePolicyDsl(parsePolicyDsl(policyJson), matchingItem);

  assert.equal(result.matched, true);
  assert.equal(result.would_action, "propose_repair");
  assert.equal(result.dry_run_only, true);
  assert.deepEqual(result.failed_conditions, []);
  assert.ok(result.matched_conditions.includes('conflict_types includes "changelog"'));
});

test("policy DSL evaluator returns matched false for non-matching item", () => {
  const result = evaluatePolicyDsl(parsePolicyDsl(policyJson), {
    ...matchingItem,
    labels: ["security"],
  });

  assert.equal(result.matched, false);
  assert.ok(result.failed_conditions.includes('labels not_includes "security"'));
});

test("policy DSL rejects unsupported and executable actions", () => {
  assert.throws(
    () =>
      parsePolicyDsl({
        ...policyJson,
        action: { type: "close_issue", mode: "dry_run_only" },
      }),
    /Unsupported policy action type/,
  );
  assert.throws(
    () =>
      parsePolicyDsl({
        ...policyJson,
        action: { type: "propose_repair", mode: "execute" },
      }),
    /mode must be dry_run_only/,
  );
});

test("policy DSL dry-run only flag is always true", () => {
  const policy = parsePolicyDsl({
    ...policyJson,
    action: { type: "annotate_only", mode: "dry_run_only" },
  });
  const result = evaluatePolicyDsl(policy, matchingItem);

  assert.equal(result.dry_run_only, true);
  assert.equal(result.would_action, "annotate_only");
});

test("policy DSL output is deterministic", () => {
  const policy = parsePolicyDsl(policyJson);
  const first = dryRunPolicyDsl(policy, { items: [matchingItem] } as never);
  const second = dryRunPolicyDsl(policy, { items: [matchingItem] } as never);

  assert.deepEqual(first, second);
});

test("policy DSL missing fields fail closed", () => {
  const result = evaluatePolicyDsl(parsePolicyDsl(policyJson), {
    item_number: 7,
    labels: ["bug"],
  });

  assert.equal(result.matched, false);
  assert.ok(result.failed_conditions.includes('conflict_types includes "changelog"'));
});

test("policy DSL CLI writes deterministic dry-run report", () => {
  const root = mkdtempSync(join(tmpdir(), "clawsweeper-policy-dsl-"));
  try {
    const policyPath = join(root, "policy.json");
    const memoryPath = join(root, "memory.json");
    const outputRoot = join(root, "out");
    mkdirSync(root, { recursive: true });
    writeFileSync(policyPath, `${JSON.stringify(policyJson)}\n`);
    writeFileSync(memoryPath, `${JSON.stringify({ items: [matchingItem] })}\n`);

    const result = runPolicyDslDryRunFromFile({
      policyPath,
      memoryPath,
      outputRoot,
    });

    assert.equal(result.ok, true);
    assert.equal(result.outputPath, join(outputRoot, `${policyJson.policy_id}.json`));
    assert.equal(result.report?.matched_count, 1);
    assert.equal(result.report?.results[0]?.dry_run_only, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
