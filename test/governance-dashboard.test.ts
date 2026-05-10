import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  collectGovernanceArtifacts,
  renderGovernanceDashboardMarkdown,
  runGovernanceDashboard,
  synthesizeGovernanceDashboard,
} from "../dist/governance-dashboard/index.js";

const generatedAt = "2026-05-09T12:00:00.000Z";

test("empty artifact directory produces valid dashboard", () => {
  const root = mkdtempSync(join(tmpdir(), "clawsweeper-governance-empty-"));
  try {
    const result = runGovernanceDashboard({
      inputRoot: root,
      outputRoot: join(root, "out"),
      generatedAt,
    });

    assert.equal(result.dashboard.schema_version, 1);
    assert.equal(result.dashboard.summary.next_safe_action, "collect_more_evidence");
    assert.ok(result.dashboard.layers.every((layer) => layer.status === "missing"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("full synthetic artifact set produces complete dashboard", () => {
  const root = mkdtempSync(join(tmpdir(), "clawsweeper-governance-full-"));
  try {
    writeArtifact(root, "review-memory/review-memory.json", {
      schema_version: 1,
      summary: { record_count: 4, pattern_count: 3 },
      patterns: [{ pattern_type: "label" }],
    });
    writeArtifact(root, "approval/approval-gate.json", {
      status: "approved_for_planning",
      plan_id: "plan-demo",
    });
    writeArtifact(root, "patch/patch-proposal.json", {
      status: "patch_proposed",
      patch_id: "patch-plan-demo",
    });
    writeArtifact(root, "patch/patch-validation.json", {
      status: "valid",
      patch_id: "patch-plan-demo",
    });
    writeArtifact(root, "shadow/shadow-patch-execution.json", {
      status: "simulated",
      patch_id: "patch-plan-demo",
    });
    writeArtifact(root, "intent/pr-creation-intent.json", {
      status: "ready",
      patch_id: "patch-plan-demo",
    });
    const dashboard = synthesizeGovernanceDashboard({
      artifacts: collectGovernanceArtifacts(root).artifacts,
      generatedAt,
    });

    assert.equal(dashboard.summary.observed, 4);
    assert.equal(dashboard.summary.approvals, 1);
    assert.equal(dashboard.summary.intents, 1);
    assert.equal(dashboard.summary.next_safe_action, "manual_pr_creation_review");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("missing artifacts are tolerated", () => {
  const dashboard = synthesizeGovernanceDashboard({
    artifacts: [
      {
        layer_id: "patch_generation",
        name: "Patch Generation",
        stage: "proposal",
        artifact_path: "patch-proposal.json",
        data: { status: "patch_proposed" },
      },
    ],
    generatedAt,
  });

  assert.ok(dashboard.layers.some((layer) => layer.status === "missing"));
  assert.equal(dashboard.summary.next_safe_action, "run_patch_validation");
});

test("blocked stages are surfaced", () => {
  const dashboard = synthesizeGovernanceDashboard({
    artifacts: [
      {
        layer_id: "patch_validation",
        name: "Patch Validation",
        stage: "approval",
        artifact_path: "patch-validation.json",
        data: {
          status: "blocked",
          blocking_risks: ["tests_to_run is missing or empty"],
        },
      },
    ],
    generatedAt,
  });

  assert.equal(dashboard.summary.blocks, 1);
  assert.equal(dashboard.summary.next_safe_action, "request_human_review");
});

test("next safe action is computed deterministically", () => {
  const input = {
    artifacts: [
      {
        layer_id: "patch_validation",
        name: "Patch Validation",
        stage: "approval" as const,
        artifact_path: "patch-validation.json",
        data: { status: "valid" },
      },
    ],
    generatedAt,
  };

  assert.deepEqual(synthesizeGovernanceDashboard(input), synthesizeGovernanceDashboard(input));
  assert.equal(
    synthesizeGovernanceDashboard(input).summary.next_safe_action,
    "run_shadow_patch_execution",
  );
});

test("safety posture is always explicit", () => {
  const dashboard = synthesizeGovernanceDashboard({ artifacts: [], generatedAt });

  assert.deepEqual(dashboard.safety_posture, {
    github_mutation: false,
    branch_creation: false,
    commit_creation: false,
    push: false,
    pr_creation: false,
    scheduler_mutation: false,
    apply_automerge_mutation: false,
  });
});

test("governance dashboard output is deterministic", () => {
  assert.deepEqual(
    synthesizeGovernanceDashboard({ artifacts: [], generatedAt }),
    synthesizeGovernanceDashboard({ artifacts: [], generatedAt }),
  );
});

test("markdown includes the principle and operator questions", () => {
  const markdown = renderGovernanceDashboardMarkdown(
    synthesizeGovernanceDashboard({ artifacts: [], generatedAt }),
  );

  assert.match(markdown, /Evidence → Proposal → Approval → Simulation → Intent/);
  assert.match(markdown, /What did it observe\?/);
  assert.match(markdown, /What is the next safe step\?/);
});

function writeArtifact(root: string, path: string, value: unknown): void {
  const fullPath = join(root, path);
  mkdirSync(fullPath.replace(/[\\/][^\\/]+$/, ""), { recursive: true });
  writeFileSync(fullPath, `${JSON.stringify(value)}\n`, "utf8");
}
