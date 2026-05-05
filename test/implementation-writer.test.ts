import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  runImplementationWriter,
  writeImplementationPromptFromPlan,
} from "../dist/implementation-writer/index.js";

const plan = {
  plan_id: "plan-improve-scheduler-saturated_backlog-1234abcd",
  proposal_id: "improve-scheduler-saturated_backlog-1234abcd",
  status: "approved_for_planning",
  approved_by: "operator",
  approved_at: "2026-05-05T12:00:00.000Z",
  approval_scope: "implementation_plan_only",
  implementation_steps: [
    "Review source evidence.",
    "Draft minimal implementation.",
    "Run focused tests before broader validation.",
  ],
  files_likely_changed: ["src/adaptive-scheduler/", "test/scheduler-improvement.test.ts"],
  tests_required: ["pnpm run build", "node --test test/scheduler-improvement.test.ts"],
  rollback_plan: ["Revert the implementation commit.", "Remove generated-state artifacts."],
  safety_constraints: [
    "Do not mutate GitHub.",
    "Do not create PRs automatically.",
    "Do not change scheduler/apply/automerge behavior automatically.",
  ],
  source_proposal: {
    proposal_id: "improve-scheduler-saturated_backlog-1234abcd",
    category: "scheduler",
    problem_summary: "Due backlog is saturating planned review capacity.",
    observed_signals: ["due backlog 72"],
    proposed_change: "Prepare an operator-reviewed scheduler capacity proposal.",
    expected_benefit:
      "Reduce due backlog pressure without changing runtime capacity automatically.",
    risk_level: "medium",
    confidence_score: 0.82,
  },
};

test("implementation writer generates Codex-ready prompt for approved plan", () => {
  const result = writeImplementationPromptFromPlan(plan);

  assert.equal(result.output.status, "ready_for_supervised_implementation");
  assert.ok(result.markdown?.includes("## Goal"));
  assert.ok(result.markdown?.includes("## Exact Scope"));
  assert.ok(result.markdown?.includes("## Final Response Requirements"));
});

test("implementation writer blocks blocked plans", () => {
  const result = writeImplementationPromptFromPlan({
    plan_id: plan.plan_id,
    proposal_id: plan.proposal_id,
    status: "blocked",
    blocked_reason: "operator approval is false",
    safety_constraints: [],
  });

  assert.equal(result.output.status, "blocked");
  assert.equal(result.markdown, undefined);
});

test("implementation writer blocks wrong approval scope", () => {
  const result = writeImplementationPromptFromPlan({
    ...plan,
    approval_scope: "execute_change",
  });

  assert.equal(result.output.status, "blocked");
});

test("implementation writer missing required fields fail closed", () => {
  const result = writeImplementationPromptFromPlan({
    ...plan,
    implementation_steps: undefined,
  });

  assert.equal(result.output.status, "blocked");
});

test("implementation writer output is deterministic", () => {
  const first = writeImplementationPromptFromPlan(plan);
  const second = writeImplementationPromptFromPlan(plan);

  assert.deepEqual(first, second);
});

test("implementation writer prompt includes rollback and safety constraints", () => {
  const result = writeImplementationPromptFromPlan(plan);

  assert.ok(result.markdown?.includes("## Rollback Plan"));
  assert.ok(result.markdown?.includes("Revert the implementation commit."));
  assert.ok(result.markdown?.includes("## Safety Constraints"));
  assert.ok(result.markdown?.includes("Do not mutate GitHub."));
});

test("implementation writer prompt excludes merge push and GitHub mutation", () => {
  const result = writeImplementationPromptFromPlan(plan);

  assert.ok(result.markdown?.includes("Do not create PRs."));
  assert.ok(result.markdown?.includes("Do not push branches."));
  assert.ok(result.markdown?.includes("Do not mutate GitHub."));
  assert.ok(result.markdown?.includes("Do not create commits."));
  assert.doesNotMatch(result.markdown ?? "", /merge this PR/i);
  assert.doesNotMatch(result.markdown ?? "", /push the branch/i);
});

test("implementation writer CLI writes markdown and JSON artifacts", () => {
  const root = mkdtempSync(join(tmpdir(), "clawsweeper-implementation-writer-"));
  try {
    const planPath = join(root, "plan.json");
    const outputRoot = join(root, "out");
    mkdirSync(root, { recursive: true });
    writeFileSync(planPath, `${JSON.stringify(plan)}\n`, "utf8");

    const result = runImplementationWriter({ planPath, outputRoot });
    const json = JSON.parse(readFileSync(result.jsonPath, "utf8")) as { status: string };
    const markdown = readFileSync(result.markdownPath ?? "", "utf8");

    assert.equal(json.status, "ready_for_supervised_implementation");
    assert.match(markdown, /Supervised Implementation Prompt/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
