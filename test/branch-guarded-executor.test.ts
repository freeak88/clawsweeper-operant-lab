import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  executeBranchGuarded,
  runBranchGuardedExecutor,
} from "../dist/branch-guarded-executor/index.js";
import type { BranchGuardedGitRunner } from "../dist/branch-guarded-executor/index.js";

const branchIntent = {
  branch_intent_id: "branch-intent-pr-intent-patch-plan-improve-memory-1234abcd",
  status: "ready",
  base_ref: "main",
  proposed_branch_name: "operator/patch-plan-improve-memory-1234abcd",
  source_pr_intent: "pr-intent-patch-plan-improve-memory-1234abcd",
  safety_checks: [],
  rollback_note: "No branch was created.",
  recommended_next_step: "manual_branch_creation_review",
  blocked_reason: null,
};

const preview = {
  execution_preview_id: "branch-dry-run-branch-intent-pr-intent-patch-plan-improve-memory-1234abcd",
  branch_intent_id: branchIntent.branch_intent_id,
  status: "ready",
  allowed_command_preview: 'git checkout -b "operator/patch-plan-improve-memory-1234abcd" "main"',
  would_execute: false,
  safety_checks: [],
  recommended_next_step: "operator_execution_review",
  blocked_reason: null,
};

test("default mode returns dry_run and does not call git", () => {
  const runner = mockRunner();
  const execution = executeBranchGuarded({ branchIntent, preview, gitRunner: runner });

  assert.equal(execution.status, "dry_run");
  assert.equal(execution.would_execute, false);
  assert.equal(execution.did_execute, false);
  assert.deepEqual(runner.calls, []);
});

test("execute mode creates branch when all checks pass", () => {
  const runner = mockRunner();
  const execution = executeBranchGuarded({
    branchIntent,
    preview,
    execute: true,
    gitRunner: runner,
  });

  assert.equal(execution.status, "executed");
  assert.equal(execution.would_execute, true);
  assert.equal(execution.did_execute, true);
  assert.deepEqual(runner.calls, [
    "isWorkingTreeClean",
    "currentBranch",
    "branchExists:operator/patch-plan-improve-memory-1234abcd",
    "refExists:main",
    "createBranch:operator/patch-plan-improve-memory-1234abcd:main",
  ]);
});

test("dirty working tree blocks", () => {
  const execution = executeBranchGuarded({
    branchIntent,
    preview,
    execute: true,
    gitRunner: mockRunner({ clean: false }),
  });

  assert.equal(execution.status, "blocked");
  assert.match(execution.blocked_reason ?? "", /working tree/);
  assert.equal(execution.did_execute, false);
});

test("existing branch blocks", () => {
  const execution = executeBranchGuarded({
    branchIntent,
    preview,
    execute: true,
    gitRunner: mockRunner({ branchExists: true }),
  });

  assert.equal(execution.status, "blocked");
  assert.match(execution.blocked_reason ?? "", /already exist/);
});

test("missing base ref blocks", () => {
  const execution = executeBranchGuarded({
    branchIntent,
    preview,
    execute: true,
    gitRunner: mockRunner({ baseExists: false }),
  });

  assert.equal(execution.status, "blocked");
  assert.match(execution.blocked_reason ?? "", /base ref/);
});

test("mismatched preview command blocks", () => {
  const execution = executeBranchGuarded({
    branchIntent,
    preview: { ...preview, allowed_command_preview: 'git checkout -b "other" "main"' },
    execute: true,
    gitRunner: mockRunner(),
  });

  assert.equal(execution.status, "blocked");
  assert.match(execution.blocked_reason ?? "", /preview command/);
});

test("needs-review input returns needs_review", () => {
  const execution = executeBranchGuarded({
    branchIntent: { ...branchIntent, status: "needs_review" },
    preview,
    execute: true,
    gitRunner: mockRunner(),
  });

  assert.equal(execution.status, "needs_review");
  assert.equal(execution.recommended_next_step, "request_human_review");
});

test("blocked input remains blocked", () => {
  const execution = executeBranchGuarded({
    branchIntent: { ...branchIntent, status: "blocked", blocked_reason: "operator blocked" },
    preview,
    execute: true,
    gitRunner: mockRunner(),
  });

  assert.equal(execution.status, "blocked");
  assert.equal(execution.blocked_reason, "operator blocked");
});

test("rollback instruction is present", () => {
  const execution = executeBranchGuarded({ branchIntent, preview });

  assert.match(execution.rollback_instruction, /git checkout/);
  assert.match(execution.rollback_instruction, /git branch -D/);
});

test("no push commit PR or GitHub commands are generated", () => {
  const execution = executeBranchGuarded({ branchIntent, preview });
  const serialized = JSON.stringify(execution);

  assert.doesNotMatch(serialized, /\bgit push\b/);
  assert.doesNotMatch(serialized, /\bgit commit\b/);
  assert.doesNotMatch(serialized, /\bgh pr\b/);
  assert.doesNotMatch(serialized, /\bgh api\b/);
});

test("CLI default writes dry-run artifacts without executing git", () => {
  const root = mkdtempSync(join(tmpdir(), "clawsweeper-branch-guarded-"));
  try {
    const branchIntentPath = join(root, "branch-creation-intent.json");
    const previewPath = join(root, "branch-dry-run-executor.json");
    const outputRoot = join(root, "out");
    writeFileSync(branchIntentPath, `${JSON.stringify(branchIntent)}\n`, "utf8");
    writeFileSync(previewPath, `${JSON.stringify(preview)}\n`, "utf8");

    const result = runBranchGuardedExecutor({ branchIntentPath, previewPath, outputRoot });
    const json = JSON.parse(readFileSync(result.jsonPath, "utf8")) as {
      status: string;
      did_execute: boolean;
    };
    const markdown = readFileSync(result.markdownPath, "utf8");

    assert.equal(json.status, "dry_run");
    assert.equal(json.did_execute, false);
    assert.match(markdown, /Default mode does not execute Git/);
    assert.match(markdown, /No push occurs/);
    assert.match(markdown, /No GitHub API calls/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function mockRunner(
  options: {
    clean?: boolean;
    currentBranch?: string;
    branchExists?: boolean;
    baseExists?: boolean;
  } = {},
): BranchGuardedGitRunner & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    isWorkingTreeClean: () => {
      calls.push("isWorkingTreeClean");
      return options.clean ?? true;
    },
    currentBranch: () => {
      calls.push("currentBranch");
      return options.currentBranch ?? "main";
    },
    branchExists: (branchName) => {
      calls.push(`branchExists:${branchName}`);
      return options.branchExists ?? false;
    },
    refExists: (refName) => {
      calls.push(`refExists:${refName}`);
      return options.baseExists ?? true;
    },
    createBranch: (branchName, baseRef) => {
      calls.push(`createBranch:${branchName}:${baseRef}`);
    },
  };
}
