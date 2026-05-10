import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  executeShadowPatch,
  runShadowPatchExecution,
} from "../dist/shadow-patch-execution/index.js";

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

test("valid patch validation produces simulated output", () => {
  const execution = executeShadowPatch({ patch: patchProposal, validation: validValidation });

  assert.equal(execution.status, "simulated");
  assert.equal(execution.recommended_next_step, "eligible_for_operator_pr_creation");
  assert.ok(execution.simulated_changes.some((change) => change.kind === "modify"));
  assert.ok(execution.simulated_changes.every((change) => change.applied === false));
});

test("needs-review validation produces needs_review output", () => {
  const execution = executeShadowPatch({
    patch: patchProposal,
    validation: {
      ...validValidation,
      status: "needs_review",
      warnings: ["sensitive path requires human review: src/clawsweeper.ts"],
    },
  });

  assert.equal(execution.status, "needs_review");
  assert.equal(execution.recommended_next_step, "request_human_review");
  assert.deepEqual(execution.simulated_changes, []);
});

test("blocked validation produces blocked output", () => {
  const execution = executeShadowPatch({
    patch: patchProposal,
    validation: {
      ...validValidation,
      status: "blocked",
      blocking_risks: ["tests_to_run is missing or empty"],
    },
  });

  assert.equal(execution.status, "blocked");
  assert.equal(execution.recommended_next_step, "stop");
  assert.ok(execution.risk_notes.includes("tests_to_run is missing or empty"));
});

test("missing and malformed inputs fail closed", () => {
  const missing = executeShadowPatch({ patch: undefined, validation: undefined });
  const malformed = executeShadowPatch({
    patch: { patch_id: "patch-bad", status: "patch_proposed" },
    validation: validValidation,
  });

  assert.equal(missing.status, "blocked");
  assert.equal(malformed.status, "blocked");
});

test("simulated tests mirror tests_to_run without executing them", () => {
  const execution = executeShadowPatch({ patch: patchProposal, validation: validValidation });

  assert.deepEqual(
    execution.simulated_tests.map((simulated) => simulated.command),
    [...patchProposal.tests_to_run].sort(),
  );
  assert.ok(execution.simulated_tests.every((simulated) => simulated.executed === false));
});

test("shadow patch execution output is deterministic", () => {
  assert.deepEqual(
    executeShadowPatch({ patch: patchProposal, validation: validValidation }),
    executeShadowPatch({ patch: patchProposal, validation: validValidation }),
  );
});

test("executor explicitly does not apply patch or modify source", () => {
  const execution = executeShadowPatch({ patch: patchProposal, validation: validValidation });
  const serialized = JSON.stringify(execution);

  assert.doesNotMatch(serialized, /executed":true/);
  assert.doesNotMatch(serialized, /applied":true/);
  assert.ok(execution.risk_notes.some((note) => note.includes("no patch was applied")));
});

test("shadow patch execution CLI writes markdown and JSON artifacts", () => {
  const root = mkdtempSync(join(tmpdir(), "clawsweeper-shadow-patch-"));
  try {
    const patchPath = join(root, "patch-proposal.json");
    const validationPath = join(root, "patch-validation.json");
    const outputRoot = join(root, "out");
    writeFileSync(patchPath, `${JSON.stringify(patchProposal)}\n`, "utf8");
    writeFileSync(validationPath, `${JSON.stringify(validValidation)}\n`, "utf8");

    const result = runShadowPatchExecution({ patchPath, validationPath, outputRoot });
    const json = JSON.parse(readFileSync(result.jsonPath, "utf8")) as { status: string };
    const markdown = readFileSync(result.markdownPath, "utf8");

    assert.equal(json.status, "simulated");
    assert.match(markdown, /No patch was applied/);
    assert.match(markdown, /No tests were executed/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
