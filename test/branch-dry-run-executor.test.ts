import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  planBranchDryRunExecution,
  runBranchDryRunExecutor,
} from "../dist/branch-dry-run-executor/index.js";

const readyBranchIntent = {
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

test("ready branch intent produces ready command preview", () => {
  const preview = planBranchDryRunExecution({ branchIntent: readyBranchIntent });

  assert.equal(preview.status, "ready");
  assert.equal(
    preview.allowed_command_preview,
    'git checkout -b "operator/patch-plan-improve-memory-1234abcd" "main"',
  );
  assert.equal(preview.recommended_next_step, "operator_execution_review");
  assert.equal(preview.would_execute, false);
});

test("blocked branch intent blocks", () => {
  const preview = planBranchDryRunExecution({
    branchIntent: {
      ...readyBranchIntent,
      status: "blocked",
      blocked_reason: "branch name does not already exist in local refs input failed",
    },
  });

  assert.equal(preview.status, "blocked");
  assert.equal(preview.recommended_next_step, "stop");
  assert.match(preview.blocked_reason ?? "", /local refs/);
});

test("needs-review branch intent returns needs_review", () => {
  const preview = planBranchDryRunExecution({
    branchIntent: { ...readyBranchIntent, status: "needs_review" },
  });

  assert.equal(preview.status, "needs_review");
  assert.equal(preview.recommended_next_step, "request_human_review");
});

test("malformed intent fails closed", () => {
  const missing = planBranchDryRunExecution({ branchIntent: undefined });
  const malformed = planBranchDryRunExecution({
    branchIntent: { status: "ready", proposed_branch_name: "operator/example" },
  });

  assert.equal(missing.status, "blocked");
  assert.equal(malformed.status, "blocked");
  assert.equal(missing.would_execute, false);
});

test("command preview is deterministic and sanitized", () => {
  const first = planBranchDryRunExecution({
    branchIntent: {
      ...readyBranchIntent,
      base_ref: "refs/heads/Main",
      proposed_branch_name: "operator/Patch Plan Improve Memory 1234ABCD!!",
    },
  });
  const second = planBranchDryRunExecution({
    branchIntent: {
      ...readyBranchIntent,
      base_ref: "refs/heads/Main",
      proposed_branch_name: "operator/Patch Plan Improve Memory 1234ABCD!!",
    },
  });

  assert.deepEqual(first, second);
  assert.equal(
    first.allowed_command_preview,
    'git checkout -b "operator/patch-plan-improve-memory-1234abcd" "main"',
  );
});

test("would_execute is always false", () => {
  for (const status of ["ready", "blocked", "needs_review"] as const) {
    const preview = planBranchDryRunExecution({
      branchIntent: { ...readyBranchIntent, status },
    });
    assert.equal(preview.would_execute, false);
  }
});

test("protected branch names remain blocked", () => {
  for (const branch of ["main", "master", "develop", "release/v1", "hotfix/urgent"]) {
    const preview = planBranchDryRunExecution({
      branchIntent: { ...readyBranchIntent, proposed_branch_name: branch },
    });
    assert.equal(preview.status, "blocked");
  }
});

test("output explicitly excludes git execution branch checkout commit push PR creation and GitHub mutation", () => {
  const preview = planBranchDryRunExecution({ branchIntent: readyBranchIntent });
  const serialized = JSON.stringify(preview);

  assert.equal(preview.would_execute, false);
  assert.doesNotMatch(serialized, /"would_execute":true/);
});

test("branch dry-run executor CLI writes markdown and JSON artifacts", () => {
  const root = mkdtempSync(join(tmpdir(), "clawsweeper-branch-dry-run-"));
  try {
    const branchIntentPath = join(root, "branch-creation-intent.json");
    const outputRoot = join(root, "out");
    writeFileSync(branchIntentPath, `${JSON.stringify(readyBranchIntent)}\n`, "utf8");

    const result = runBranchDryRunExecutor({ branchIntentPath, outputRoot });
    const json = JSON.parse(readFileSync(result.jsonPath, "utf8")) as {
      status: string;
      would_execute: boolean;
    };
    const markdown = readFileSync(result.markdownPath, "utf8");

    assert.equal(json.status, "ready");
    assert.equal(json.would_execute, false);
    assert.match(markdown, /No git command was executed/);
    assert.match(markdown, /No branch was created/);
    assert.match(markdown, /No checkout occurred/);
    assert.match(markdown, /No PR was created/);
    assert.match(markdown, /No GitHub API calls/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
