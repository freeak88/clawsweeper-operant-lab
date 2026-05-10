import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  runLocalValidation,
  runLocalValidationRunner,
} from "../dist/local-validation-runner/index.js";
import type { LocalValidationCommandRunner } from "../dist/local-validation-runner/index.js";

const patch = {
  patch_id: "patch-plan-improve-memory-1234abcd",
  status: "patch_proposed",
  tests_to_run: [
    "pnpm run build",
    "node --test test/memory-improvement.test.ts",
    "pnpm exec oxlint src/review-memory --tsconfig tsconfig.json",
    "pnpm exec oxfmt --check src/review-memory",
  ],
};

const application = {
  application_id: "isolated-patch-patch-plan-improve-memory-1234abcd",
  patch_id: patch.patch_id,
  status: "applied_isolated",
  workspace_root: resolve("D:/Repos/clawsweeper"),
  isolated_workspace: resolve("D:/Temp/clawsweeper-isolated/patch-plan-improve-memory-1234abcd"),
  did_apply: true,
  simulated_files: [],
  applied_files: [],
  diff_report: [],
  rollback_instruction: "Remove isolated workspace.",
  recommended_next_step: "run_local_validation",
  blocked_reason: null,
};

test("default mode returns dry_run and does not execute commands", () => {
  const runner = mockRunner();
  const validation = runLocalValidation({
    application,
    patch,
    mainRepoRoot: "D:/Repos/clawsweeper",
    runner,
  });

  assert.equal(validation.status, "dry_run");
  assert.equal(validation.did_execute, false);
  assert.deepEqual(runner.calls, []);
});

test("execute mode runs allowlisted commands with mocked runner", () => {
  const runner = mockRunner();
  const validation = runLocalValidation({
    application,
    patch,
    mainRepoRoot: "D:/Repos/clawsweeper",
    execute: true,
    runner,
  });

  assert.equal(validation.status, "passed");
  assert.equal(validation.did_execute, true);
  assert.deepEqual(runner.calls, patch.tests_to_run);
});

test("non-isolated application blocks", () => {
  const validation = runLocalValidation({
    application: { ...application, status: "dry_run" },
    patch,
    mainRepoRoot: "D:/Repos/clawsweeper",
    execute: true,
    runner: mockRunner(),
  });

  assert.equal(validation.status, "blocked");
  assert.match(validation.blocked_reason ?? "", /applied_isolated/);
});

test("workspace inside main repo blocks", () => {
  const validation = runLocalValidation({
    application: {
      ...application,
      isolated_workspace: resolve("D:/Repos/clawsweeper/results/isolated-workspace"),
    },
    patch,
    mainRepoRoot: "D:/Repos/clawsweeper",
    execute: true,
    runner: mockRunner(),
  });

  assert.equal(validation.status, "blocked");
  assert.match(validation.blocked_reason ?? "", /main repository/);
});

test("disallowed command blocks", () => {
  const validation = runLocalValidation({
    application,
    patch: { ...patch, tests_to_run: ["pnpm run build", "git status"] },
    mainRepoRoot: "D:/Repos/clawsweeper",
    execute: true,
    runner: mockRunner(),
  });

  assert.equal(validation.status, "blocked");
  assert.match(validation.blocked_reason ?? "", /denied/);
});

test("failed validation command returns failed", () => {
  const validation = runLocalValidation({
    application,
    patch,
    mainRepoRoot: "D:/Repos/clawsweeper",
    execute: true,
    runner: mockRunner({ failCommand: "node --test test/memory-improvement.test.ts" }),
  });

  assert.equal(validation.status, "failed");
  assert.equal(validation.recommended_next_step, "stop");
  assert.match(validation.blocked_reason ?? "", /node --test/);
});

test("passed validation commands return passed", () => {
  const validation = runLocalValidation({
    application,
    patch,
    mainRepoRoot: "D:/Repos/clawsweeper",
    execute: true,
    runner: mockRunner(),
  });

  assert.equal(validation.status, "passed");
  assert.equal(validation.recommended_next_step, "prepare_commit_intent");
});

test("missing and malformed inputs fail closed", () => {
  const missing = runLocalValidation({ application: undefined, patch: undefined });
  const malformed = runLocalValidation({
    application: { status: "applied_isolated" },
    patch: { status: "patch_proposed" },
  });

  assert.equal(missing.status, "blocked");
  assert.equal(malformed.status, "blocked");
});

test("output is deterministic", () => {
  assert.deepEqual(
    runLocalValidation({ application, patch, mainRepoRoot: "D:/Repos/clawsweeper" }),
    runLocalValidation({ application, patch, mainRepoRoot: "D:/Repos/clawsweeper" }),
  );
});

test("no git gh network or destructive commands are allowed", () => {
  for (const command of [
    "git status",
    "gh pr create",
    "curl https://example.com",
    "wget https://example.com",
    "rm -rf dist",
    "powershell Get-ChildItem",
    "ssh example.com",
    "scp file host:",
    "npm publish",
  ]) {
    const validation = runLocalValidation({
      application,
      patch: { ...patch, tests_to_run: [command] },
      mainRepoRoot: "D:/Repos/clawsweeper",
      execute: true,
      runner: mockRunner(),
    });
    assert.equal(validation.status, "blocked");
  }
});

test("CLI default writes dry-run artifacts", () => {
  const root = mkdtempSync(join(tmpdir(), "clawsweeper-local-validation-"));
  try {
    const applicationPath = join(root, "isolated-patch-application.json");
    const patchPath = join(root, "patch-proposal.json");
    const outputRoot = join(root, "out");
    writeFileSync(applicationPath, `${JSON.stringify(application)}\n`, "utf8");
    writeFileSync(patchPath, `${JSON.stringify(patch)}\n`, "utf8");

    const result = runLocalValidationRunner({ applicationPath, patchPath, outputRoot });
    const json = JSON.parse(readFileSync(result.jsonPath, "utf8")) as {
      status: string;
      did_execute: boolean;
    };
    const markdown = readFileSync(result.markdownPath, "utf8");

    assert.equal(json.status, "dry_run");
    assert.equal(json.did_execute, false);
    assert.match(markdown, /Default mode does not run validation commands/);
    assert.match(markdown, /The main working tree is not validated or modified/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function mockRunner(options: { failCommand?: string } = {}): LocalValidationCommandRunner & {
  calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    run: (command, workspaceRoot) => {
      assert.equal(workspaceRoot, application.isolated_workspace);
      calls.push(command);
      if (command === options.failCommand) {
        return { command, exit_code: 1, status: "failed", output: "failed" };
      }
      return { command, exit_code: 0, status: "passed", output: "ok" };
    },
  };
}
