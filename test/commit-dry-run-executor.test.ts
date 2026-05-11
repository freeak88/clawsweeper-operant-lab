import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  planCommitDryRunExecution,
  runCommitDryRunExecutor,
} from "../dist/commit-dry-run-executor/index.js";

const readyCommitIntent = {
  commit_intent_id: "commit-intent-patch-plan-improve-memory-1234abcd",
  patch_id: "patch-plan-improve-memory-1234abcd",
  status: "ready",
  proposed_commit_message: "feat: improve memory 1234abcd",
  files_expected: [
    "src/review-memory/indexer.ts",
    "docs/memory-improvement-plan.md",
    "test/memory-improvement.test.ts",
  ],
  validation_evidence: [
    "node --test test/memory-improvement.test.ts passed with exit code 0",
    "pnpm run build passed with exit code 0",
  ],
  rollback_note: "No commit has been created.",
  recommended_next_step: "manual_commit_review",
  blocked_reason: null,
};

test("ready commit intent produces ready command preview", () => {
  const preview = planCommitDryRunExecution({ commitIntent: readyCommitIntent });

  assert.equal(preview.status, "ready");
  assert.equal(preview.recommended_next_step, "operator_commit_execution_review");
  assert.equal(preview.would_execute, false);
  assert.deepEqual(preview.allowed_commands_preview, [
    'git add "docs/memory-improvement-plan.md" "src/review-memory/indexer.ts" "test/memory-improvement.test.ts"',
    'git commit -m "feat: improve memory 1234abcd"',
  ]);
});

test("blocked commit intent blocks", () => {
  const preview = planCommitDryRunExecution({
    commitIntent: {
      ...readyCommitIntent,
      status: "blocked",
      blocked_reason: "local validation status is not passed: failed",
    },
  });

  assert.equal(preview.status, "blocked");
  assert.equal(preview.recommended_next_step, "stop");
  assert.match(preview.blocked_reason ?? "", /not passed/);
});

test("needs-review commit intent returns needs_review", () => {
  const preview = planCommitDryRunExecution({
    commitIntent: { ...readyCommitIntent, status: "needs_review" },
  });

  assert.equal(preview.status, "needs_review");
  assert.equal(preview.recommended_next_step, "request_human_review");
});

test("empty files_expected blocks", () => {
  const preview = planCommitDryRunExecution({
    commitIntent: { ...readyCommitIntent, files_expected: [] },
  });

  assert.equal(preview.status, "blocked");
  assert.match(preview.blocked_reason ?? "", /expected files/);
});

test("invalid commit message blocks", () => {
  const missing = planCommitDryRunExecution({
    commitIntent: { ...readyCommitIntent, proposed_commit_message: "" },
  });
  const nonConventional = planCommitDryRunExecution({
    commitIntent: { ...readyCommitIntent, proposed_commit_message: "update stuff" },
  });
  const unsafe = planCommitDryRunExecution({
    commitIntent: { ...readyCommitIntent, proposed_commit_message: "feat: ok && git push" },
  });

  assert.equal(missing.status, "blocked");
  assert.equal(nonConventional.status, "blocked");
  assert.equal(unsafe.status, "blocked");
});

test("command preview is deterministic and sanitized", () => {
  const intent = {
    ...readyCommitIntent,
    files_expected: [
      "test/memory-improvement.test.ts",
      "src/review-memory/indexer.ts",
      'docs/memory "improvement".md',
    ],
    proposed_commit_message: 'feat: improve "memory" 1234abcd',
  };
  const first = planCommitDryRunExecution({ commitIntent: intent });
  const second = planCommitDryRunExecution({ commitIntent: intent });

  assert.deepEqual(first, second);
  assert.deepEqual(first.allowed_commands_preview, [
    'git add "docs/memory improvement.md" "src/review-memory/indexer.ts" "test/memory-improvement.test.ts"',
    'git commit -m "feat: improve memory 1234abcd"',
  ]);
});

test("would_execute is always false", () => {
  for (const status of ["ready", "blocked", "needs_review"] as const) {
    const preview = planCommitDryRunExecution({
      commitIntent: { ...readyCommitIntent, status },
    });
    assert.equal(preview.would_execute, false);
  }
});

test("output excludes staging execution commit execution push PR creation and GitHub mutation", () => {
  const preview = planCommitDryRunExecution({ commitIntent: readyCommitIntent });
  const serialized = JSON.stringify(preview);

  assert.equal(preview.would_execute, false);
  assert.doesNotMatch(serialized, /"would_execute":true/);
  assert.doesNotMatch(serialized, /git push|gh pr|gh api|pull request/i);
});

test("missing and malformed input fails closed", () => {
  const missing = planCommitDryRunExecution({ commitIntent: undefined });
  const malformed = planCommitDryRunExecution({
    commitIntent: { status: "ready", proposed_commit_message: "feat: example" },
  });

  assert.equal(missing.status, "blocked");
  assert.equal(malformed.status, "blocked");
});

test("commit dry-run executor CLI writes markdown and JSON artifacts", () => {
  const root = mkdtempSync(join(tmpdir(), "clawsweeper-commit-dry-run-"));
  try {
    const commitIntentPath = join(root, "commit-intent.json");
    const outputRoot = join(root, "out");
    writeFileSync(commitIntentPath, `${JSON.stringify(readyCommitIntent)}\n`, "utf8");

    const result = runCommitDryRunExecutor({ commitIntentPath, outputRoot });
    const json = JSON.parse(readFileSync(result.jsonPath, "utf8")) as {
      status: string;
      would_execute: boolean;
    };
    const markdown = readFileSync(result.markdownPath, "utf8");

    assert.equal(json.status, "ready");
    assert.equal(json.would_execute, false);
    assert.match(markdown, /No files were staged/);
    assert.match(markdown, /No commit was created/);
    assert.match(markdown, /No push occurred/);
    assert.match(markdown, /No PR was created/);
    assert.match(markdown, /No GitHub API calls/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
