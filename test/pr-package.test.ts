import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { generatePrPackage, runPrPackage } from "../dist/pr-package/index.js";

const patch = {
  patch_id: "patch-plan-improve-memory-1234abcd",
  plan_id: "plan-improve-memory-1234abcd",
  proposal_id: "improve-memory-1234abcd",
  status: "patch_proposed",
  summary: "Improve review memory indexing with additional deterministic evidence.",
  intended_changes: ["Add local documentation."],
  files_to_modify: ["src/review-memory/indexer.ts"],
  files_to_add: ["docs/memory-improvement-plan.md", "test/memory-improvement.test.ts"],
  tests_to_run: ["pnpm run build", "node --test test/memory-improvement.test.ts"],
  rollback_plan: ["git reset --soft HEAD~1", "Remove isolated workspace."],
  safety_constraints: ["No GitHub mutation.", "No scheduler/apply/automerge behavior change."],
  non_goals: ["Do not push branches.", "Do not create PRs."],
  blocked_reason: null,
};

const application = {
  application_id: "isolated-patch-patch-plan-improve-memory-1234abcd",
  patch_id: patch.patch_id,
  status: "applied_isolated",
  workspace_root: "D:/Repos/clawsweeper",
  isolated_workspace: "D:/Temp/clawsweeper-isolated/patch-plan-improve-memory-1234abcd",
  did_apply: true,
  simulated_files: [],
  applied_files: ["docs/memory-improvement-plan.md", "src/review-memory/indexer.ts"],
  diff_report: ["add docs/memory-improvement-plan.md", "modify src/review-memory/indexer.ts"],
  rollback_instruction:
    "Remove isolated workspace: D:/Temp/clawsweeper-isolated/patch-plan-improve-memory-1234abcd",
  recommended_next_step: "run_local_validation",
  blocked_reason: null,
};

const validation = {
  validation_run_id: "local-validation-patch-plan-improve-memory-1234abcd",
  patch_id: patch.patch_id,
  status: "passed",
  workspace_root: application.isolated_workspace,
  did_execute: true,
  commands: ["pnpm run build", "node --test test/memory-improvement.test.ts"],
  results: [
    { command: "pnpm run build", exit_code: 0, status: "passed", output: "ok" },
    {
      command: "node --test test/memory-improvement.test.ts",
      exit_code: 0,
      status: "passed",
      output: "ok",
    },
  ],
  recommended_next_step: "prepare_commit_intent",
  blocked_reason: null,
};

const commitIntent = {
  commit_intent_id: "commit-intent-patch-plan-improve-memory-1234abcd",
  patch_id: patch.patch_id,
  status: "ready",
  proposed_commit_message: "feat: improve memory 1234abcd",
  files_expected: [
    "docs/memory-improvement-plan.md",
    "src/review-memory/indexer.ts",
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

const commitExecution = {
  execution_id: "commit-guarded-commit-intent-patch-plan-improve-memory-1234abcd",
  commit_intent_id: commitIntent.commit_intent_id,
  status: "committed",
  would_execute: true,
  did_execute: true,
  commands: [
    'git add "docs/memory-improvement-plan.md" "src/review-memory/indexer.ts" "test/memory-improvement.test.ts"',
    'git commit -m "feat: improve memory 1234abcd"',
  ],
  commit_hash: "abc123def456",
  rollback_instruction: "git reset --soft HEAD~1",
  recommended_next_step: "prepare_pr_creation",
  blocked_reason: null,
};

test("committed execution produces ready PR package", () => {
  const prPackage = generatePrPackage({
    commitExecution,
    commitIntent,
    validation,
    application,
    patch,
  });

  assert.equal(prPackage.status, "ready");
  assert.equal(prPackage.commit_hash, "abc123def456");
  assert.equal(prPackage.recommended_next_step, "manual_pr_review");
  assert.equal(prPackage.title, "Supervised patch: improve memory 1234abcd");
});

test("dry-run commit execution blocks", () => {
  const prPackage = generatePrPackage({
    commitExecution: { ...commitExecution, status: "dry_run", commit_hash: null },
    commitIntent,
    validation,
    application,
    patch,
  });

  assert.equal(prPackage.status, "blocked");
  assert.match(prPackage.blocked_reason ?? "", /not committed/);
});

test("missing commit hash blocks", () => {
  const prPackage = generatePrPackage({
    commitExecution: { ...commitExecution, commit_hash: null },
    commitIntent,
    validation,
    application,
    patch,
  });

  assert.equal(prPackage.status, "blocked");
  assert.match(prPackage.blocked_reason ?? "", /commit hash/);
});

test("failed validation blocks", () => {
  const prPackage = generatePrPackage({
    commitExecution,
    commitIntent,
    validation: { ...validation, status: "failed" },
    application,
    patch,
  });

  assert.equal(prPackage.status, "blocked");
  assert.match(prPackage.blocked_reason ?? "", /validation status/);
});

test("needs-review propagates needs_review", () => {
  const prPackage = generatePrPackage({
    commitExecution: { ...commitExecution, status: "needs_review" },
    commitIntent,
    validation,
    application,
    patch,
  });

  assert.equal(prPackage.status, "needs_review");
  assert.equal(prPackage.recommended_next_step, "request_human_review");
});

test("body includes validation evidence", () => {
  const prPackage = generatePrPackage({
    commitExecution,
    commitIntent,
    validation,
    application,
    patch,
  });

  assert.match(prPackage.body, /pnpm run build passed with exit code 0/);
  assert.match(prPackage.body, /node --test test\/memory-improvement.test.ts passed/);
});

test("body includes rollback plan", () => {
  const prPackage = generatePrPackage({
    commitExecution,
    commitIntent,
    validation,
    application,
    patch,
  });

  assert.match(prPackage.body, /git reset --soft HEAD~1/);
  assert.match(prPackage.body, /Remove isolated workspace/);
});

test("body includes safety statement", () => {
  const prPackage = generatePrPackage({
    commitExecution,
    commitIntent,
    validation,
    application,
    patch,
  });

  assert.match(prPackage.body, /no push occurred/i);
  assert.match(prPackage.body, /no PR was created/i);
  assert.match(prPackage.body, /no GitHub API calls/i);
});

test("output is deterministic", () => {
  const first = generatePrPackage({
    commitExecution,
    commitIntent,
    validation,
    application,
    patch,
  });
  const second = generatePrPackage({
    commitExecution,
    commitIntent,
    validation,
    application,
    patch,
  });

  assert.deepEqual(first, second);
});

test("no push gh PR creation or GitHub mutation commands appear", () => {
  const prPackage = generatePrPackage({
    commitExecution,
    commitIntent,
    validation,
    application,
    patch,
  });
  const serialized = JSON.stringify(prPackage);

  assert.doesNotMatch(serialized, /\bgit push\b/);
  assert.doesNotMatch(serialized, /\bgh pr\b/);
  assert.doesNotMatch(serialized, /\bgh api\b/);
  assert.doesNotMatch(serialized, /pr create/i);
});

test("PR package CLI writes markdown and JSON artifacts", () => {
  const root = mkdtempSync(join(tmpdir(), "clawsweeper-pr-package-"));
  try {
    const paths = {
      commitExecution: join(root, "commit-guarded-execution.json"),
      commitIntent: join(root, "commit-intent.json"),
      validation: join(root, "local-validation-result.json"),
      application: join(root, "isolated-patch-application.json"),
      patch: join(root, "patch-proposal.json"),
      outputRoot: join(root, "out"),
    };
    writeFileSync(paths.commitExecution, `${JSON.stringify(commitExecution)}\n`, "utf8");
    writeFileSync(paths.commitIntent, `${JSON.stringify(commitIntent)}\n`, "utf8");
    writeFileSync(paths.validation, `${JSON.stringify(validation)}\n`, "utf8");
    writeFileSync(paths.application, `${JSON.stringify(application)}\n`, "utf8");
    writeFileSync(paths.patch, `${JSON.stringify(patch)}\n`, "utf8");

    const result = runPrPackage({
      commitExecutionPath: paths.commitExecution,
      commitIntentPath: paths.commitIntent,
      validationPath: paths.validation,
      applicationPath: paths.application,
      patchPath: paths.patch,
      outputRoot: paths.outputRoot,
    });
    const json = JSON.parse(readFileSync(result.jsonPath, "utf8")) as { status: string };
    const markdown = readFileSync(result.markdownPath, "utf8");

    assert.equal(json.status, "ready");
    assert.match(markdown, /PR Package/);
    assert.match(markdown, /No push occurred/);
    assert.match(markdown, /No PR was created/);
    assert.match(markdown, /No GitHub API calls/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
