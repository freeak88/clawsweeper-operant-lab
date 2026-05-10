import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runPatchValidation, validatePatchProposal } from "../dist/patch-validation/index.js";

const safePatch = {
  patch_id: "patch-plan-improve-memory-1234abcd",
  plan_id: "plan-improve-memory-1234abcd",
  proposal_id: "improve-memory-1234abcd",
  status: "patch_proposed",
  summary: "Patch proposal for improve-memory-1234abcd. This is not an applied patch.",
  intended_changes: ["Add local documentation and focused tests."],
  files_to_modify: ["src/review-memory/"],
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

test("patch validation returns valid for safe patch proposal", () => {
  const validation = validatePatchProposal(safePatch);

  assert.equal(validation.status, "valid");
  assert.equal(validation.recommended_next_step, "eligible_for_shadow_execution");
  assert.deepEqual(validation.blocking_risks, []);
});

test("patch validation preserves blocked patch proposals as blocked", () => {
  const validation = validatePatchProposal({
    ...safePatch,
    status: "blocked",
    blocked_reason: "plan was blocked",
  });

  assert.equal(validation.status, "blocked");
  assert.ok(validation.blocking_risks.includes("patch proposal is blocked"));
});

test("patch validation blocks missing tests", () => {
  const validation = validatePatchProposal({ ...safePatch, tests_to_run: [] });

  assert.equal(validation.status, "blocked");
  assert.ok(validation.blocking_risks.includes("tests_to_run is missing or empty"));
});

test("patch validation blocks missing rollback", () => {
  const validation = validatePatchProposal({ ...safePatch, rollback_plan: [] });

  assert.equal(validation.status, "blocked");
  assert.ok(validation.blocking_risks.includes("rollback_plan is missing or empty"));
});

test("patch validation blocks missing safety constraints", () => {
  const validation = validatePatchProposal({ ...safePatch, safety_constraints: [] });

  assert.equal(validation.status, "blocked");
  assert.ok(validation.blocking_risks.includes("safety_constraints is missing or empty"));
});

test("patch validation marks sensitive paths as needs_review", () => {
  const validation = validatePatchProposal({
    ...safePatch,
    files_to_modify: ["src/clawsweeper.ts", ".github/workflows/sweep.yml"],
  });

  assert.equal(validation.status, "needs_review");
  assert.equal(validation.recommended_next_step, "request_human_review");
  assert.ok(validation.warnings.some((warning) => warning.includes("src/clawsweeper.ts")));
});

test("patch validation output is deterministic", () => {
  assert.deepEqual(validatePatchProposal(safePatch), validatePatchProposal(safePatch));
});

test("patch validation is artifact-only and does not apply patch", () => {
  const validation = validatePatchProposal(safePatch);
  const serialized = JSON.stringify(validation);

  assert.doesNotMatch(serialized, /applied patch/i);
  assert.ok(
    validation.summary.includes("artifact-only") || validation.summary.includes("validation"),
  );
});

test("patch validation CLI writes markdown and JSON artifacts", () => {
  const root = mkdtempSync(join(tmpdir(), "clawsweeper-patch-validation-"));
  try {
    const patchPath = join(root, "patch-proposal.json");
    const outputRoot = join(root, "out");
    mkdirSync(root, { recursive: true });
    writeFileSync(patchPath, `${JSON.stringify(safePatch)}\n`, "utf8");

    const result = runPatchValidation({ patchPath, outputRoot });
    const json = JSON.parse(readFileSync(result.jsonPath, "utf8")) as { status: string };
    const markdown = readFileSync(result.markdownPath, "utf8");

    assert.equal(json.status, "valid");
    assert.match(markdown, /No patch was applied/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
