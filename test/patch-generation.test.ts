import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { generatePatchProposal, runPatchGeneration } from "../dist/patch-generation/index.js";

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
  files_likely_changed: [
    "src/adaptive-scheduler/",
    "docs/scheduler-improvement-plan.md",
    "test/scheduler-improvement.test.ts",
  ],
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

test("patch generation creates proposal for approved plan", () => {
  const proposal = generatePatchProposal({ plan });

  assert.equal(proposal.status, "patch_proposed");
  assert.equal(proposal.blocked_reason, null);
  assert.match(proposal.summary, /not an applied patch/i);
  assert.ok(proposal.intended_changes.includes("Draft minimal implementation."));
});

test("patch generation blocks blocked plans", () => {
  const proposal = generatePatchProposal({
    plan: {
      plan_id: plan.plan_id,
      proposal_id: plan.proposal_id,
      status: "blocked",
      blocked_reason: "operator approval is false",
      safety_constraints: [],
    },
  });

  assert.equal(proposal.status, "blocked");
  assert.match(proposal.blocked_reason ?? "", /not approved_for_planning/);
});

test("patch generation missing required fields fail closed", () => {
  const proposal = generatePatchProposal({ plan: { ...plan, tests_required: undefined } });

  assert.equal(proposal.status, "blocked");
});

test("patch generation blocks wrong approval scope", () => {
  const proposal = generatePatchProposal({ plan: { ...plan, approval_scope: "execute_change" } });

  assert.equal(proposal.status, "blocked");
});

test("patch generation output is deterministic", () => {
  assert.deepEqual(generatePatchProposal({ plan }), generatePatchProposal({ plan }));
});

test("patch generation includes tests and rollback plan", () => {
  const proposal = generatePatchProposal({ plan });

  assert.ok(proposal.tests_to_run.includes("pnpm run build"));
  assert.ok(proposal.rollback_plan.includes("Revert the implementation commit."));
});

test("patch generation excludes commit push PR merge and GitHub mutation", () => {
  const proposal = generatePatchProposal({ plan });
  const serialized = JSON.stringify(proposal);

  assert.ok(proposal.non_goals.includes("Do not create commits."));
  assert.ok(proposal.non_goals.includes("Do not push branches."));
  assert.ok(proposal.non_goals.includes("Do not create PRs."));
  assert.ok(proposal.non_goals.includes("Do not merge."));
  assert.ok(proposal.non_goals.includes("Do not mutate GitHub."));
  assert.doesNotMatch(serialized, /create a pull request/i);
  assert.doesNotMatch(serialized, /push the branch/i);
});

test("patch generation CLI writes markdown and JSON artifacts", () => {
  const root = mkdtempSync(join(tmpdir(), "clawsweeper-patch-generation-"));
  try {
    const planPath = join(root, "plan.json");
    const outputRoot = join(root, "out");
    mkdirSync(root, { recursive: true });
    writeFileSync(planPath, `${JSON.stringify(plan)}\n`, "utf8");

    const result = runPatchGeneration({ planPath, outputRoot });
    const json = JSON.parse(readFileSync(result.jsonPath, "utf8")) as { status: string };
    const markdown = readFileSync(result.markdownPath, "utf8");

    assert.equal(json.status, "patch_proposed");
    assert.match(markdown, /No patch has been applied/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
