import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  executeCommitGuarded,
  runCommitGuardedExecutor,
} from "../dist/commit-guarded-executor/index.js";
import type { CommitGuardedGitRunner } from "../dist/commit-guarded-executor/index.js";

const commitIntent = {
  commit_intent_id: "commit-intent-patch-plan-improve-memory-1234abcd",
  patch_id: "patch-plan-improve-memory-1234abcd",
  status: "ready",
  proposed_commit_message: "feat: improve memory 1234abcd",
  files_expected: [
    "docs/memory-improvement-plan.md",
    "src/review-memory/indexer.ts",
    "test/memory-improvement.test.ts",
  ],
  validation_evidence: ["pnpm run build passed with exit code 0"],
  rollback_note: "No commit has been created.",
  recommended_next_step: "manual_commit_review",
  blocked_reason: null,
};

const preview = {
  execution_preview_id: "commit-dry-run-commit-intent-patch-plan-improve-memory-1234abcd",
  commit_intent_id: commitIntent.commit_intent_id,
  status: "ready",
  allowed_commands_preview: [
    'git add "docs/memory-improvement-plan.md" "src/review-memory/indexer.ts" "test/memory-improvement.test.ts"',
    'git commit -m "feat: improve memory 1234abcd"',
  ],
  would_execute: false,
  safety_checks: [],
  recommended_next_step: "operator_commit_execution_review",
  blocked_reason: null,
};

test("default mode returns dry_run and does not call git", () => {
  const runner = mockRunner();
  const execution = executeCommitGuarded({ commitIntent, preview, gitRunner: runner });

  assert.equal(execution.status, "dry_run");
  assert.equal(execution.would_execute, false);
  assert.equal(execution.did_execute, false);
  assert.deepEqual(runner.calls, []);
});

test("execute mode stages and commits with mocked runner when all checks pass", () => {
  const runner = mockRunner();
  const execution = executeCommitGuarded({
    commitIntent,
    preview,
    execute: true,
    gitRunner: runner,
  });

  assert.equal(execution.status, "committed");
  assert.equal(execution.would_execute, true);
  assert.equal(execution.did_execute, true);
  assert.equal(execution.commit_hash, "abc123def456");
  assert.deepEqual(runner.calls, [
    "changedFiles",
    "stageFiles:docs/memory-improvement-plan.md,src/review-memory/indexer.ts,test/memory-improvement.test.ts",
    "commit:feat: improve memory 1234abcd",
    "revParseHead",
  ]);
});

test("mismatched preview command blocks", () => {
  const execution = executeCommitGuarded({
    commitIntent,
    preview: { ...preview, allowed_commands_preview: ['git commit -m "feat: nope"'] },
    execute: true,
    gitRunner: mockRunner(),
  });

  assert.equal(execution.status, "blocked");
  assert.match(execution.blocked_reason ?? "", /preview commands/);
});

test("unexpected changed file blocks", () => {
  const execution = executeCommitGuarded({
    commitIntent,
    preview,
    execute: true,
    gitRunner: mockRunner({ changedFiles: [...commitIntent.files_expected, "src/unexpected.ts"] }),
  });

  assert.equal(execution.status, "blocked");
  assert.match(execution.blocked_reason ?? "", /only expected files/);
  assert.equal(execution.did_execute, false);
});

test("empty expected files blocks", () => {
  const execution = executeCommitGuarded({
    commitIntent: { ...commitIntent, files_expected: [] },
    preview,
    execute: true,
    gitRunner: mockRunner(),
  });

  assert.equal(execution.status, "blocked");
  assert.match(execution.blocked_reason ?? "", /expected files/);
});

test("invalid commit message blocks", () => {
  const execution = executeCommitGuarded({
    commitIntent: { ...commitIntent, proposed_commit_message: "update stuff" },
    preview,
    execute: true,
    gitRunner: mockRunner(),
  });

  assert.equal(execution.status, "blocked");
  assert.match(execution.blocked_reason ?? "", /conventional/);
});

test("blocked commit intent blocks", () => {
  const execution = executeCommitGuarded({
    commitIntent: {
      ...commitIntent,
      status: "blocked",
      blocked_reason: "local validation status is not passed: failed",
    },
    preview,
    execute: true,
    gitRunner: mockRunner(),
  });

  assert.equal(execution.status, "blocked");
  assert.match(execution.blocked_reason ?? "", /not passed/);
});

test("needs-review commit intent returns needs_review", () => {
  const execution = executeCommitGuarded({
    commitIntent: { ...commitIntent, status: "needs_review" },
    preview,
    execute: true,
    gitRunner: mockRunner(),
  });

  assert.equal(execution.status, "needs_review");
  assert.equal(execution.recommended_next_step, "request_human_review");
});

test("rollback instruction is present", () => {
  const dryRun = executeCommitGuarded({ commitIntent, preview });
  const committed = executeCommitGuarded({
    commitIntent,
    preview,
    execute: true,
    gitRunner: mockRunner(),
  });

  assert.match(dryRun.rollback_instruction, /No commit was created/);
  assert.match(committed.rollback_instruction, /git reset --soft HEAD~1/);
});

test("no push PR GitHub or destructive commands are generated or executed", () => {
  const runner = mockRunner();
  const execution = executeCommitGuarded({
    commitIntent,
    preview,
    execute: true,
    gitRunner: runner,
  });
  const serialized = `${JSON.stringify(execution)} ${runner.calls.join(" ")}`;

  assert.doesNotMatch(serialized, /\bgit push\b/);
  assert.doesNotMatch(serialized, /\bgh pr\b/);
  assert.doesNotMatch(serialized, /\bgh api\b/);
  assert.doesNotMatch(serialized, /\brm -rf\b/);
});

test("CLI default writes dry-run artifacts without executing git", () => {
  const root = mkdtempSync(join(tmpdir(), "clawsweeper-commit-guarded-"));
  try {
    const commitIntentPath = join(root, "commit-intent.json");
    const previewPath = join(root, "commit-dry-run-executor.json");
    const outputRoot = join(root, "out");
    writeFileSync(commitIntentPath, `${JSON.stringify(commitIntent)}\n`, "utf8");
    writeFileSync(previewPath, `${JSON.stringify(preview)}\n`, "utf8");

    const result = runCommitGuardedExecutor({ commitIntentPath, previewPath, outputRoot });
    const json = JSON.parse(readFileSync(result.jsonPath, "utf8")) as {
      status: string;
      did_execute: boolean;
    };
    const markdown = readFileSync(result.markdownPath, "utf8");

    assert.equal(json.status, "dry_run");
    assert.equal(json.did_execute, false);
    assert.match(markdown, /Default mode does not stage or commit/);
    assert.match(markdown, /No push occurs/);
    assert.match(markdown, /No GitHub API calls/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function mockRunner(
  options: {
    changedFiles?: string[];
    commitHash?: string;
  } = {},
): CommitGuardedGitRunner & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    changedFiles: () => {
      calls.push("changedFiles");
      return options.changedFiles ?? commitIntent.files_expected;
    },
    stageFiles: (files) => {
      calls.push(`stageFiles:${files.join(",")}`);
    },
    commit: (message) => {
      calls.push(`commit:${message}`);
    },
    revParseHead: () => {
      calls.push("revParseHead");
      return options.commitHash ?? "abc123def456";
    },
  };
}
