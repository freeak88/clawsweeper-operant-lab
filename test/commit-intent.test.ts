import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { planCommitIntent, runCommitIntent } from "../dist/commit-intent/index.js";

const patch = {
  patch_id: "patch-plan-improve-memory-1234abcd",
  plan_id: "plan-improve-memory-1234abcd",
  proposal_id: "improve-memory-1234abcd",
  status: "patch_proposed",
  summary: "Patch proposal. This is not an applied patch.",
  intended_changes: ["Add local documentation."],
  files_to_modify: ["src/review-memory/indexer.ts"],
  files_to_add: ["docs/memory-improvement-plan.md", "test/memory-improvement.test.ts"],
  tests_to_run: ["pnpm run build"],
  rollback_plan: ["Remove isolated workspace.", "Discard generated artifacts."],
  safety_constraints: ["Do not mutate GitHub."],
  non_goals: ["Do not create commits.", "Do not push branches."],
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
  applied_files: ["docs/memory-improvement-plan.md"],
  diff_report: ["add docs/memory-improvement-plan.md"],
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

test("passed validation produces ready commit intent", () => {
  const intent = planCommitIntent({ validation, application, patch });

  assert.equal(intent.status, "ready");
  assert.equal(intent.recommended_next_step, "manual_commit_review");
  assert.equal(intent.blocked_reason, null);
});

test("failed validation blocks", () => {
  const intent = planCommitIntent({
    validation: { ...validation, status: "failed" },
    application,
    patch,
  });

  assert.equal(intent.status, "blocked");
  assert.match(intent.blocked_reason ?? "", /not passed/);
});

test("dry-run validation blocks", () => {
  const intent = planCommitIntent({
    validation: { ...validation, status: "dry_run" },
    application,
    patch,
  });

  assert.equal(intent.status, "blocked");
});

test("needs-review propagates needs_review", () => {
  const intent = planCommitIntent({
    validation: { ...validation, status: "needs_review" },
    application,
    patch,
  });

  assert.equal(intent.status, "needs_review");
  assert.equal(intent.recommended_next_step, "request_human_review");
});

test("missing and malformed inputs fail closed", () => {
  const missing = planCommitIntent({
    validation: undefined,
    application: undefined,
    patch: undefined,
  });
  const malformed = planCommitIntent({
    validation: { status: "passed" },
    application: { status: "applied_isolated" },
    patch: { status: "patch_proposed" },
  });

  assert.equal(missing.status, "blocked");
  assert.equal(malformed.status, "blocked");
});

test("commit message is deterministic and conventional", () => {
  const first = planCommitIntent({ validation, application, patch });
  const second = planCommitIntent({ validation, application, patch });

  assert.deepEqual(first, second);
  assert.match(first.proposed_commit_message, /^feat: /);
  assert.equal(first.proposed_commit_message, "feat: improve memory 1234abcd");
});

test("validation evidence is included", () => {
  const intent = planCommitIntent({ validation, application, patch });

  assert.deepEqual(intent.validation_evidence, [
    "node --test test/memory-improvement.test.ts passed with exit code 0",
    "pnpm run build passed with exit code 0",
  ]);
});

test("rollback note is included", () => {
  const intent = planCommitIntent({ validation, application, patch });

  assert.match(intent.rollback_note, /Remove isolated workspace/);
  assert.match(intent.rollback_note, /Discard generated artifacts/);
});

test("output explicitly excludes stage commit push PR creation and GitHub mutation", () => {
  const intent = planCommitIntent({ validation, application, patch });
  const serialized = JSON.stringify(intent);

  assert.doesNotMatch(serialized, /\bgit add\b/);
  assert.doesNotMatch(serialized, /\bgit commit\b/);
  assert.doesNotMatch(serialized, /\bgit push\b/);
  assert.doesNotMatch(serialized, /\bgh pr\b/);
  assert.doesNotMatch(serialized, /\bgh api\b/);
});

test("commit intent CLI writes markdown and JSON artifacts", () => {
  const root = mkdtempSync(join(tmpdir(), "clawsweeper-commit-intent-"));
  try {
    const validationPath = join(root, "local-validation-result.json");
    const applicationPath = join(root, "isolated-patch-application.json");
    const patchPath = join(root, "patch-proposal.json");
    const outputRoot = join(root, "out");
    writeFileSync(validationPath, `${JSON.stringify(validation)}\n`, "utf8");
    writeFileSync(applicationPath, `${JSON.stringify(application)}\n`, "utf8");
    writeFileSync(patchPath, `${JSON.stringify(patch)}\n`, "utf8");

    const result = runCommitIntent({ validationPath, applicationPath, patchPath, outputRoot });
    const json = JSON.parse(readFileSync(result.jsonPath, "utf8")) as { status: string };
    const markdown = readFileSync(result.markdownPath, "utf8");

    assert.equal(json.status, "ready");
    assert.match(markdown, /No files were staged/);
    assert.match(markdown, /No commit was created/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
