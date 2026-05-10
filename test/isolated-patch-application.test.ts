import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  applyPatchIsolated,
  runIsolatedPatchApplication,
} from "../dist/isolated-patch-application/index.js";
import type { IsolatedPatchRunner } from "../dist/isolated-patch-application/index.js";

const patch = {
  patch_id: "patch-plan-improve-memory-1234abcd",
  plan_id: "plan-improve-memory-1234abcd",
  proposal_id: "improve-memory-1234abcd",
  status: "patch_proposed",
  summary: "Patch proposal. This is not an applied patch.",
  intended_changes: ["Add local documentation.", "Add focused tests."],
  files_to_modify: ["src/review-memory/indexer.ts"],
  files_to_add: ["docs/memory-improvement-plan.md", "test/memory-improvement.test.ts"],
  tests_to_run: ["pnpm run build"],
  rollback_plan: ["Remove isolated workspace."],
  safety_constraints: ["Do not mutate GitHub."],
  non_goals: [
    "Do not create commits.",
    "Do not create PRs.",
    "Do not merge.",
    "Do not mutate GitHub.",
    "Do not push branches.",
  ],
  blocked_reason: null,
};

const validation = {
  validation_id: "patch-validation-patch-plan-improve-memory-1234abcd",
  patch_id: patch.patch_id,
  status: "valid",
  checks: [],
  blocking_risks: [],
  warnings: [],
  recommended_next_step: "eligible_for_shadow_execution",
  summary: "Patch proposal is valid.",
};

const branchExecution = {
  execution_id: "branch-guarded-branch-intent-demo",
  branch_intent_id: "branch-intent-demo",
  status: "executed",
  would_execute: true,
  did_execute: true,
  command: 'git checkout -b "operator/demo" "main"',
  safety_checks: [],
  rollback_instruction: 'git checkout "main" && git branch -D "operator/demo"',
  recommended_next_step: "run_local_validation",
  blocked_reason: null,
};

test("default mode returns dry_run and does not copy or apply files", () => {
  const runner = mockRunner();
  const application = applyPatchIsolated({
    patch,
    validation,
    branchExecution,
    outputRoot: "D:/tmp/output",
    runner,
  });

  assert.equal(application.status, "dry_run");
  assert.equal(application.did_apply, false);
  assert.deepEqual(runner.calls, []);
});

test("execute mode applies only in isolated workspace with mocked filesystem runner", () => {
  const runner = mockRunner({
    appliedFiles: ["docs/memory-improvement-plan.md", "test/memory-improvement.test.ts"],
    diffReport: ["add docs/memory-improvement-plan.md", "add test/memory-improvement.test.ts"],
  });
  const application = applyPatchIsolated({
    patch,
    validation,
    branchExecution,
    workspaceRoot: "D:/Repos/clawsweeper",
    mainRepoRoot: "D:/Repos/clawsweeper",
    outputRoot: "D:/Temp/clawsweeper-isolated",
    execute: true,
    runner,
  });

  assert.equal(application.status, "applied_isolated");
  assert.equal(application.did_apply, true);
  assert.ok(application.isolated_workspace.startsWith(resolve("D:/Temp/clawsweeper-isolated")));
  assert.deepEqual(runner.calls, [
    `prepare:${resolve("D:/Repos/clawsweeper")}:${application.isolated_workspace}`,
    `apply:${application.isolated_workspace}`,
  ]);
});

test("main repo path blocks", () => {
  const application = applyPatchIsolated({
    patch,
    validation,
    branchExecution,
    workspaceRoot: "D:/Repos/clawsweeper",
    mainRepoRoot: "D:/Repos/clawsweeper",
    outputRoot: "D:/Repos/clawsweeper/results/isolated-patch-application",
    execute: true,
    runner: mockRunner(),
  });

  assert.equal(application.status, "blocked");
  assert.match(application.blocked_reason ?? "", /main repository/);
});

test("invalid patch validation blocks", () => {
  const application = applyPatchIsolated({
    patch,
    validation: { ...validation, status: "blocked" },
    branchExecution,
    execute: true,
    runner: mockRunner(),
  });

  assert.equal(application.status, "blocked");
  assert.match(application.blocked_reason ?? "", /validation status/);
});

test("branch execution not executed blocks", () => {
  const application = applyPatchIsolated({
    patch,
    validation,
    branchExecution: { ...branchExecution, status: "dry_run" },
    execute: true,
    runner: mockRunner(),
  });

  assert.equal(application.status, "blocked");
  assert.match(application.blocked_reason ?? "", /branch guarded execution/);
});

test("needs-review validation returns needs_review", () => {
  const application = applyPatchIsolated({
    patch,
    validation: { ...validation, status: "needs_review" },
    branchExecution,
    execute: true,
    runner: mockRunner(),
  });

  assert.equal(application.status, "needs_review");
  assert.equal(application.recommended_next_step, "request_human_review");
});

test("diff report is generated from mocked result", () => {
  const application = applyPatchIsolated({
    patch,
    validation,
    branchExecution,
    workspaceRoot: "D:/Repos/clawsweeper",
    mainRepoRoot: "D:/Repos/clawsweeper",
    outputRoot: "D:/Temp/clawsweeper-isolated",
    execute: true,
    runner: mockRunner({ diffReport: ["modify src/review-memory/indexer.ts"] }),
  });

  assert.deepEqual(application.diff_report, ["modify src/review-memory/indexer.ts"]);
});

test("rollback instruction is present", () => {
  const application = applyPatchIsolated({ patch, validation, branchExecution });

  assert.match(
    application.rollback_instruction,
    /No isolated patch was applied|Remove isolated workspace/,
  );
});

test("output is deterministic", () => {
  assert.deepEqual(
    applyPatchIsolated({ patch, validation, branchExecution, outputRoot: "D:/tmp/output" }),
    applyPatchIsolated({ patch, validation, branchExecution, outputRoot: "D:/tmp/output" }),
  );
});

test("no commit push PR or GitHub commands are generated", () => {
  const application = applyPatchIsolated({ patch, validation, branchExecution });
  const serialized = JSON.stringify(application);

  assert.doesNotMatch(serialized, /\bgit commit\b/);
  assert.doesNotMatch(serialized, /\bgit push\b/);
  assert.doesNotMatch(serialized, /\bgh pr\b/);
  assert.doesNotMatch(serialized, /\bgh api\b/);
});

test("CLI default writes dry-run artifacts", () => {
  const root = mkdtempSync(join(tmpdir(), "clawsweeper-isolated-patch-"));
  try {
    const patchPath = join(root, "patch-proposal.json");
    const validationPath = join(root, "patch-validation.json");
    const branchExecutionPath = join(root, "branch-guarded-execution.json");
    const outputRoot = join(root, "out");
    writeFileSync(patchPath, `${JSON.stringify(patch)}\n`, "utf8");
    writeFileSync(validationPath, `${JSON.stringify(validation)}\n`, "utf8");
    writeFileSync(branchExecutionPath, `${JSON.stringify(branchExecution)}\n`, "utf8");

    const result = runIsolatedPatchApplication({
      patchPath,
      validationPath,
      branchExecutionPath,
      outputRoot,
    });
    const json = JSON.parse(readFileSync(result.jsonPath, "utf8")) as {
      status: string;
      did_apply: boolean;
    };
    const markdown = readFileSync(result.markdownPath, "utf8");

    assert.equal(json.status, "dry_run");
    assert.equal(json.did_apply, false);
    assert.match(markdown, /Default mode does not copy or apply files/);
    assert.match(markdown, /Patches are never applied to the main working tree/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function mockRunner(
  options: {
    appliedFiles?: string[];
    diffReport?: string[];
  } = {},
): IsolatedPatchRunner & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    prepareWorkspace: (workspaceRoot, isolatedWorkspace) => {
      calls.push(`prepare:${workspaceRoot}:${isolatedWorkspace}`);
    },
    applyPatch: (_patch, isolatedWorkspace) => {
      calls.push(`apply:${isolatedWorkspace}`);
      return {
        appliedFiles: options.appliedFiles ?? ["src/review-memory/indexer.ts"],
        diffReport: options.diffReport ?? ["modify src/review-memory/indexer.ts"],
      };
    },
  };
}
