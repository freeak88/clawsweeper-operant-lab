import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildSupervisedPatchPipelineDemo,
  runSupervisedPatchPipelineDemo,
} from "../dist/supervised-patch-pipeline-demo/index.js";

const generatedAt = "2026-05-09T12:00:00.000Z";

test("supervised patch pipeline demo produces full happy path", () => {
  const report = buildSupervisedPatchPipelineDemo({ generatedAt });

  assert.equal(report.summary.approval_status, "approved_for_planning");
  assert.equal(report.summary.patch_status, "patch_proposed");
  assert.equal(report.summary.validation_status, "valid");
  assert.equal(report.summary.shadow_status, "simulated");
  assert.equal(report.summary.pr_intent_status, "ready");
  assert.equal(report.summary.executed_count, 0);
});

test("supervised patch pipeline demo blocks approval path", () => {
  const report = buildSupervisedPatchPipelineDemo({
    generatedAt,
    scenario: "blocked_approval",
  });

  assert.equal(report.summary.approval_status, "blocked");
  assert.equal(report.summary.final_status, "blocked");
  assert.match(report.artifacts.pr_creation_intent.blocked_reason ?? "", /patch proposal/);
});

test("supervised patch pipeline demo reports needs_review validation path", () => {
  const report = buildSupervisedPatchPipelineDemo({
    generatedAt,
    scenario: "needs_review_validation",
  });

  assert.equal(report.summary.validation_status, "needs_review");
  assert.equal(report.summary.shadow_status, "needs_review");
  assert.equal(report.summary.pr_intent_status, "needs_review");
});

test("supervised patch pipeline demo output is deterministic", () => {
  const first = buildSupervisedPatchPipelineDemo({ generatedAt });
  const second = buildSupervisedPatchPipelineDemo({ generatedAt });

  assert.deepEqual(first, second);
});

test("supervised patch pipeline demo safety text is present", () => {
  const root = mkdtempSync(join(tmpdir(), "clawsweeper-pipeline-demo-"));
  try {
    const result = runSupervisedPatchPipelineDemo({ outputRoot: root, generatedAt });
    const markdown = readFileSync(result.markdownPath, "utf8");
    const json = JSON.parse(readFileSync(result.jsonPath, "utf8")) as {
      safety_boundary: Record<string, boolean>;
    };

    assert.match(markdown, /No GitHub mutation/);
    assert.match(markdown, /No branch creation/);
    assert.match(markdown, /No PR creation/);
    assert.ok(Object.values(json.safety_boundary).every((value) => value === false));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
