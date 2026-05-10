import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  planBranchCreationIntent,
  runBranchCreationIntent,
} from "../dist/branch-creation-intent/index.js";

const readyPrIntent = {
  intent_id: "pr-intent-patch-plan-improve-memory-1234abcd",
  patch_id: "patch-plan-improve-memory-1234abcd",
  status: "ready",
  branch_name: "operator/Patch Plan Improve Memory 1234ABCD",
  pr_title: "Supervised patch proposal: improve-memory-1234abcd",
  pr_body: "Intent-only PR body.",
  files_expected: ["src/review-memory/indexer.ts"],
  tests_required: ["pnpm run build"],
  safety_constraints: ["Do not mutate GitHub."],
  operator_approval: {},
  recommended_next_step: "ready_for_manual_pr_creation",
  blocked_reason: null,
};

test("ready PR intent produces ready branch intent", () => {
  const intent = planBranchCreationIntent({
    prIntent: readyPrIntent,
    baseRef: "main",
  });

  assert.equal(intent.status, "ready");
  assert.equal(intent.base_ref, "main");
  assert.equal(intent.proposed_branch_name, "operator/patch-plan-improve-memory-1234abcd");
  assert.equal(intent.recommended_next_step, "manual_branch_creation_review");
});

test("blocked PR intent blocks branch intent", () => {
  const intent = planBranchCreationIntent({
    prIntent: { ...readyPrIntent, status: "blocked" },
    baseRef: "main",
  });

  assert.equal(intent.status, "blocked");
  assert.equal(intent.recommended_next_step, "stop");
});

test("needs-review PR intent returns needs_review", () => {
  const intent = planBranchCreationIntent({
    prIntent: { ...readyPrIntent, status: "needs_review" },
    baseRef: "main",
  });

  assert.equal(intent.status, "needs_review");
  assert.equal(intent.recommended_next_step, "request_human_review");
});

test("missing and malformed PR intent fails closed", () => {
  const missing = planBranchCreationIntent({ prIntent: undefined, baseRef: "main" });
  const malformed = planBranchCreationIntent({
    prIntent: { status: "ready", branch_name: "operator/example" },
    baseRef: "main",
  });

  assert.equal(missing.status, "blocked");
  assert.equal(malformed.status, "blocked");
});

test("branch name is deterministic and sanitized", () => {
  const first = planBranchCreationIntent({ prIntent: readyPrIntent, baseRef: "main" });
  const second = planBranchCreationIntent({ prIntent: readyPrIntent, baseRef: "main" });

  assert.deepEqual(first, second);
  assert.equal(first.proposed_branch_name, "operator/patch-plan-improve-memory-1234abcd");
});

test("protected branch names are blocked", () => {
  for (const branch of ["main", "master", "develop", "release/v1", "hotfix/urgent"]) {
    const intent = planBranchCreationIntent({
      prIntent: { ...readyPrIntent, branch_name: branch },
      baseRef: "main",
    });
    assert.equal(intent.status, "blocked");
  }
});

test("existing local ref blocks", () => {
  const intent = planBranchCreationIntent({
    prIntent: readyPrIntent,
    baseRef: "main",
    localRefs: ["refs/heads/operator/patch-plan-improve-memory-1234abcd"],
  });

  assert.equal(intent.status, "blocked");
  assert.match(intent.blocked_reason ?? "", /local refs/);
});

test("output explicitly excludes git branch checkout commit push PR creation and GitHub mutation", () => {
  const intent = planBranchCreationIntent({
    prIntent: readyPrIntent,
    baseRef: "main",
  });
  const serialized = JSON.stringify(intent);

  assert.doesNotMatch(serialized, /created":true/);
  assert.equal(intent.status, "ready");
});

test("branch creation intent output is deterministic", () => {
  assert.deepEqual(
    planBranchCreationIntent({ prIntent: readyPrIntent, baseRef: "main" }),
    planBranchCreationIntent({ prIntent: readyPrIntent, baseRef: "main" }),
  );
});

test("branch creation intent CLI writes markdown and JSON artifacts", () => {
  const root = mkdtempSync(join(tmpdir(), "clawsweeper-branch-intent-"));
  try {
    const prIntentPath = join(root, "pr-creation-intent.json");
    const refsPath = join(root, "refs.txt");
    const outputRoot = join(root, "out");
    writeFileSync(prIntentPath, `${JSON.stringify(readyPrIntent)}\n`, "utf8");
    writeFileSync(refsPath, "main\noperator/other-branch\n", "utf8");

    const result = runBranchCreationIntent({
      prIntentPath,
      outputRoot,
      baseRef: "main",
      localRefsPath: refsPath,
    });
    const json = JSON.parse(readFileSync(result.jsonPath, "utf8")) as { status: string };
    const markdown = readFileSync(result.markdownPath, "utf8");

    assert.equal(json.status, "ready");
    assert.match(markdown, /No branch was created/);
    assert.match(markdown, /No checkout occurred/);
    assert.match(markdown, /No PR was created/);
    assert.match(markdown, /No GitHub API calls/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
