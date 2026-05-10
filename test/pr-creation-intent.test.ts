import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { planPrCreationIntent, runPrCreationIntent } from "../dist/pr-creation-intent/index.js";

const patchProposal = {
  patch_id: "patch-plan-improve-memory-1234abcd",
  plan_id: "plan-improve-memory-1234abcd",
  proposal_id: "improve-memory-1234abcd",
  status: "patch_proposed",
  summary: "Patch proposal for improve-memory-1234abcd. This is not an applied patch.",
  intended_changes: ["Add deterministic memory summarization.", "Add focused tests."],
  files_to_modify: ["src/review-memory/indexer.ts"],
  files_to_add: ["docs/memory-improvement-plan.md", "test/memory-improvement.test.ts"],
  tests_to_run: ["pnpm run build", "node --test test/memory-improvement.test.ts"],
  rollback_plan: ["Revert the implementation commit."],
  safety_constraints: ["Do not mutate GitHub.", "Do not create PRs automatically."],
  non_goals: [
    "Do not create commits.",
    "Do not create PRs.",
    "Do not merge.",
    "Do not mutate GitHub.",
    "Do not push branches.",
  ],
  blocked_reason: null,
};

const validValidation = {
  validation_id: "validation-patch-plan-improve-memory-1234abcd",
  patch_id: "patch-plan-improve-memory-1234abcd",
  status: "valid",
  checks: [],
  blocking_risks: [],
  warnings: [],
  recommended_next_step: "eligible_for_shadow_execution",
  summary: "Patch proposal passed artifact-only validation.",
};

const simulatedShadow = {
  shadow_execution_id: "shadow-patch-plan-improve-memory-1234abcd",
  patch_id: "patch-plan-improve-memory-1234abcd",
  status: "simulated",
  simulated_changes: [],
  simulated_tests: [{ command: "pnpm run build", executed: false }],
  risk_notes: ["shadow execution only; no patch was applied"],
  recommended_next_step: "eligible_for_operator_pr_creation",
  summary: "Patch proposal shadow simulation completed without applying changes.",
};

const validApproval = {
  patch_id: "patch-plan-improve-memory-1234abcd",
  approved: true,
  approved_by: "operator",
  approved_at: "2026-05-06T12:00:00.000Z",
  approval_scope: "pr_creation_intent_only",
  notes: "Prepare a manual PR intent only.",
};

test("valid patch validation shadow and approval produces ready intent", () => {
  const intent = planPrCreationIntent({
    patch: patchProposal,
    validation: validValidation,
    shadow: simulatedShadow,
    approval: validApproval,
  });

  assert.equal(intent.status, "ready");
  assert.equal(intent.recommended_next_step, "ready_for_manual_pr_creation");
  assert.equal(intent.branch_name, "operator/patch-plan-improve-memory-1234abcd");
  assert.equal(intent.blocked_reason, null);
});

test("missing approval blocks", () => {
  const intent = planPrCreationIntent({
    patch: patchProposal,
    validation: validValidation,
    shadow: simulatedShadow,
    approval: undefined,
  });

  assert.equal(intent.status, "blocked");
  assert.equal(intent.recommended_next_step, "stop");
  assert.match(intent.blocked_reason ?? "", /approval/);
});

test("wrong approval scope blocks", () => {
  const intent = planPrCreationIntent({
    patch: patchProposal,
    validation: validValidation,
    shadow: simulatedShadow,
    approval: { ...validApproval, approval_scope: "implementation_plan_only" },
  });

  assert.equal(intent.status, "blocked");
  assert.match(intent.blocked_reason ?? "", /scope/);
});

test("validation needs_review produces needs_review intent", () => {
  const intent = planPrCreationIntent({
    patch: patchProposal,
    validation: { ...validValidation, status: "needs_review" },
    shadow: simulatedShadow,
    approval: validApproval,
  });

  assert.equal(intent.status, "needs_review");
  assert.equal(intent.recommended_next_step, "request_human_review");
});

test("blocked shadow execution blocks", () => {
  const intent = planPrCreationIntent({
    patch: patchProposal,
    validation: validValidation,
    shadow: { ...simulatedShadow, status: "blocked" },
    approval: validApproval,
  });

  assert.equal(intent.status, "blocked");
  assert.match(intent.blocked_reason ?? "", /shadow execution/);
});

test("PR body includes safety constraints and tests", () => {
  const intent = planPrCreationIntent({
    patch: patchProposal,
    validation: validValidation,
    shadow: simulatedShadow,
    approval: validApproval,
  });

  assert.match(intent.pr_body, /## Tests Required/);
  assert.match(intent.pr_body, /pnpm run build/);
  assert.match(intent.pr_body, /## Safety Constraints/);
  assert.match(intent.pr_body, /Do not mutate GitHub/);
});

test("PR creation intent output is deterministic", () => {
  const input = {
    patch: patchProposal,
    validation: validValidation,
    shadow: simulatedShadow,
    approval: validApproval,
  };
  assert.deepEqual(planPrCreationIntent(input), planPrCreationIntent(input));
});

test("intent explicitly excludes branch commit push PR merge and GitHub mutation", () => {
  const intent = planPrCreationIntent({
    patch: patchProposal,
    validation: validValidation,
    shadow: simulatedShadow,
    approval: validApproval,
  });
  const serialized = JSON.stringify(intent);

  assert.match(serialized, /Do not create a branch/);
  assert.match(serialized, /Do not create commits/);
  assert.match(serialized, /Do not push branches/);
  assert.match(serialized, /Do not create PRs/);
  assert.match(serialized, /Do not merge/);
  assert.match(serialized, /Do not mutate GitHub/);
});

test("PR creation intent CLI writes markdown and JSON artifacts", () => {
  const root = mkdtempSync(join(tmpdir(), "clawsweeper-pr-intent-"));
  try {
    const patchPath = join(root, "patch-proposal.json");
    const validationPath = join(root, "patch-validation.json");
    const shadowPath = join(root, "shadow-patch-execution.json");
    const approvalPath = join(root, "approval.json");
    const outputRoot = join(root, "out");
    writeFileSync(patchPath, `${JSON.stringify(patchProposal)}\n`, "utf8");
    writeFileSync(validationPath, `${JSON.stringify(validValidation)}\n`, "utf8");
    writeFileSync(shadowPath, `${JSON.stringify(simulatedShadow)}\n`, "utf8");
    writeFileSync(approvalPath, `${JSON.stringify(validApproval)}\n`, "utf8");

    const result = runPrCreationIntent({
      patchPath,
      validationPath,
      shadowPath,
      approvalPath,
      outputRoot,
    });
    const json = JSON.parse(readFileSync(result.jsonPath, "utf8")) as { status: string };
    const markdown = readFileSync(result.markdownPath, "utf8");

    assert.equal(json.status, "ready");
    assert.match(markdown, /No PR was created/);
    assert.match(markdown, /No branch was created/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
