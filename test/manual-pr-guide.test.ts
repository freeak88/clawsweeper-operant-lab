import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { generateManualPrGuide, runManualPrGuide } from "../dist/manual-pr-guide/index.js";

const prPackage = {
  pr_package_id: "pr-package-commit-intent-patch-plan-improve-memory-1234abcd",
  commit_hash: "abc123def456",
  status: "ready",
  title: "Supervised patch: improve memory 1234abcd",
  body: "## Summary\n\nImprove review memory.\n\n## Safety Statement\n\nNo push occurred.",
  diff_summary: ["modify src/review-memory/indexer.ts"],
  validation_evidence: ["pnpm run build passed with exit code 0"],
  rollback_plan: ["git reset --soft HEAD~1", "Remove isolated workspace."],
  risk_notes: ["Manual PR review is required before any remote action."],
  operator_checklist: ["Review the changed files and diff summary."],
  recommended_next_step: "manual_pr_review",
  blocked_reason: null,
};

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

const commitExecution = {
  execution_id: "commit-guarded-commit-intent-patch-plan-improve-memory-1234abcd",
  commit_intent_id: "commit-intent-patch-plan-improve-memory-1234abcd",
  status: "committed",
  would_execute: true,
  did_execute: true,
  commands: [
    'git add "docs/memory-improvement-plan.md"',
    'git commit -m "feat: improve memory 1234abcd"',
  ],
  commit_hash: "abc123def456",
  rollback_instruction: "git reset --soft HEAD~1",
  recommended_next_step: "prepare_pr_creation",
  blocked_reason: null,
};

test("ready PR package produces ready manual guide", () => {
  const guide = generateManualPrGuide({ prPackage, branchIntent, commitExecution });

  assert.equal(guide.status, "ready");
  assert.equal(guide.branch_name, branchIntent.proposed_branch_name);
  assert.equal(guide.commit_hash, "abc123def456");
  assert.equal(guide.pr_title, prPackage.title);
  assert.equal(guide.recommended_next_step, "operator_manual_pr_creation");
});

test("blocked PR package blocks", () => {
  const guide = generateManualPrGuide({
    prPackage: { ...prPackage, status: "blocked", blocked_reason: "missing validation" },
    branchIntent,
    commitExecution,
  });

  assert.equal(guide.status, "blocked");
  assert.match(guide.blocked_reason ?? "", /not ready/);
});

test("needs-review PR package propagates needs_review", () => {
  const guide = generateManualPrGuide({
    prPackage: { ...prPackage, status: "needs_review" },
    branchIntent,
    commitExecution,
  });

  assert.equal(guide.status, "needs_review");
  assert.equal(guide.recommended_next_step, "request_human_review");
});

test("missing branch name blocks", () => {
  const guide = generateManualPrGuide({
    prPackage,
    branchIntent: { ...branchIntent, proposed_branch_name: "" },
    commitExecution,
  });

  assert.equal(guide.status, "blocked");
  assert.match(guide.blocked_reason ?? "", /branch name/);
});

test("missing commit hash blocks", () => {
  const guide = generateManualPrGuide({
    prPackage: { ...prPackage, commit_hash: "" },
    branchIntent,
    commitExecution: { ...commitExecution, commit_hash: "" },
  });

  assert.equal(guide.status, "blocked");
  assert.match(guide.blocked_reason ?? "", /commit hash/);
});

test("missing PR body or title blocks", () => {
  const missingTitle = generateManualPrGuide({
    prPackage: { ...prPackage, title: "" },
    branchIntent,
    commitExecution,
  });
  const missingBody = generateManualPrGuide({
    prPackage: { ...prPackage, body: "" },
    branchIntent,
    commitExecution,
  });

  assert.equal(missingTitle.status, "blocked");
  assert.equal(missingBody.status, "blocked");
  assert.match(missingTitle.blocked_reason ?? "", /title/);
  assert.match(missingBody.blocked_reason ?? "", /body/);
});

test("guide includes pre-push checklist", () => {
  const guide = generateManualPrGuide({ prPackage, branchIntent, commitExecution });

  assert.match(guide.pre_push_checklist.join("\n"), /working tree is clean/);
  assert.match(guide.pre_push_checklist.join("\n"), /Confirm branch name/);
});

test("guide includes risk acceptance checklist", () => {
  const guide = generateManualPrGuide({ prPackage, branchIntent, commitExecution });

  assert.match(guide.risk_acceptance_checklist.join("\n"), /remote action is manual/);
  assert.match(guide.risk_acceptance_checklist.join("\n"), /rollback is understood/);
});

test("guide includes rollback steps", () => {
  const guide = generateManualPrGuide({ prPackage, branchIntent, commitExecution });

  assert.match(guide.rollback_steps.join("\n"), /git reset --soft HEAD~1/);
  assert.match(guide.rollback_steps.join("\n"), /Remove isolated workspace/);
});

test("guide includes do_not_do safety list", () => {
  const guide = generateManualPrGuide({ prPackage, branchIntent, commitExecution });

  assert.deepEqual(guide.do_not_do, [
    "do not bypass validation",
    "do not create PR without reviewing body",
    "do not merge automatically",
    "do not push without final operator review",
  ]);
});

test("output is deterministic", () => {
  const first = generateManualPrGuide({ prPackage, branchIntent, commitExecution });
  const second = generateManualPrGuide({ prPackage, branchIntent, commitExecution });

  assert.deepEqual(first, second);
});

test("no gh push PR creation or GitHub API execution appears as executable action", () => {
  const guide = generateManualPrGuide({ prPackage, branchIntent, commitExecution });
  const executableLines = [...guide.manual_steps, ...guide.pre_push_checklist].join("\n");

  assert.doesNotMatch(executableLines, /\bgh\b/);
  assert.doesNotMatch(executableLines, /\bgit push\b/);
  assert.doesNotMatch(executableLines, /pr create/i);
  assert.doesNotMatch(executableLines, /api/i);
});

test("manual PR guide CLI writes markdown and JSON artifacts", () => {
  const root = mkdtempSync(join(tmpdir(), "clawsweeper-manual-pr-guide-"));
  try {
    const paths = {
      prPackage: join(root, "pr-package.json"),
      branchIntent: join(root, "branch-creation-intent.json"),
      commitExecution: join(root, "commit-guarded-execution.json"),
      outputRoot: join(root, "out"),
    };
    writeFileSync(paths.prPackage, `${JSON.stringify(prPackage)}\n`, "utf8");
    writeFileSync(paths.branchIntent, `${JSON.stringify(branchIntent)}\n`, "utf8");
    writeFileSync(paths.commitExecution, `${JSON.stringify(commitExecution)}\n`, "utf8");

    const result = runManualPrGuide({
      prPackagePath: paths.prPackage,
      branchIntentPath: paths.branchIntent,
      commitExecutionPath: paths.commitExecution,
      outputRoot: paths.outputRoot,
    });
    const json = JSON.parse(readFileSync(result.jsonPath, "utf8")) as { status: string };
    const markdown = readFileSync(result.markdownPath, "utf8");

    assert.equal(json.status, "ready");
    assert.match(markdown, /Manual PR Creation Guide/);
    assert.match(markdown, /the system prepares; the operator decides/i);
    assert.match(markdown, /GitHub APIs/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
