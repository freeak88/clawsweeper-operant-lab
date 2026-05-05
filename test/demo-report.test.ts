import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { normalizeDemoRepoInput, runDemoReport } from "../dist/demo-report/index.js";

const generatedAt = "2026-05-05T12:00:00.000Z";

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), "clawsweeper-demo-report-"));
}

function writeRecord(path: string, content: string): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function runFixture(root: string) {
  return runDemoReport({
    repoInput: "https://github.com/openclaw/openclaw",
    outputRoot: join(root, "results", "demo-report"),
    recordsRoot: join(root, "records"),
    policyRfcRoot: join(root, "results", "policy-rfc"),
    maxRecords: 50,
    minOccurrences: 3,
    generatedAt,
  });
}

test("demo report parser accepts HTTPS GitHub URLs", () => {
  assert.deepEqual(normalizeDemoRepoInput("https://github.com/openclaw/openclaw"), {
    owner: "openclaw",
    repo: "openclaw",
    target_repo: "openclaw/openclaw",
    repo_slug: "openclaw-openclaw",
  });
});

test("demo report parser accepts SSH GitHub URLs", () => {
  assert.deepEqual(normalizeDemoRepoInput("git@github.com:openclaw/openclaw.git"), {
    owner: "openclaw",
    repo: "openclaw",
    target_repo: "openclaw/openclaw",
    repo_slug: "openclaw-openclaw",
  });
});

test("demo report parser accepts owner/repo input", () => {
  assert.equal(normalizeDemoRepoInput("openclaw/openclaw").target_repo, "openclaw/openclaw");
});

test("demo report parser rejects invalid repo input", () => {
  assert.throws(() => normalizeDemoRepoInput("https://example.com/openclaw/openclaw"), /Invalid/);
  assert.throws(() => normalizeDemoRepoInput("openclaw"), /Invalid/);
});

test("demo report no-records case writes markdown and JSON", () => {
  const root = tempRoot();
  try {
    const result = runFixture(root);
    const markdown = readFileSync(result.markdownPath, "utf8");

    assert.equal(result.report.input.record_count, 0);
    assert.equal(result.report.summary.executed_count, 0);
    assert.ok(existsSync(result.markdownPath));
    assert.ok(existsSync(result.jsonPath));
    assert.match(markdown, /No durable records found for this repository/);
    assert.match(markdown, /No GitHub API calls were made/);
    assert.match(markdown, /No actions were executed/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("demo report safety boundary is always false", () => {
  const root = tempRoot();
  try {
    const result = runFixture(root);

    assert.deepEqual(result.report.safety_boundary, {
      github_mutation: false,
      execution_enabled: false,
      guarded_execution: false,
      repair_dispatch: false,
      issue_close: false,
      pr_merge: false,
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("demo report local-record case writes expected artifacts", () => {
  const root = tempRoot();
  try {
    const recordsRoot = join(root, "records", "openclaw-openclaw", "items");
    for (const item of [1, 2, 3]) {
      writeRecord(
        join(recordsRoot, `${item}.md`),
        `---
labels: bug
decision: keep_open
---

clawsweeper-verdict:needs_repair
Conflict type: changelog
`,
      );
    }

    const result = runFixture(root);
    const outputDir = join(root, "results", "demo-report", "openclaw-openclaw");

    assert.equal(result.report.input.record_count, 3);
    assert.ok(result.report.summary.pattern_count >= 1);
    assert.ok(result.report.summary.policy_rfc_count >= 1);
    assert.ok(result.report.summary.shadow_match_count >= 1);
    assert.equal(result.report.artifacts.review_memory, "artifacts/review-memory.json");
    assert.equal(result.report.artifacts.policy_rfc_dir, "artifacts/policy-rfc");
    assert.equal(result.report.artifacts.shadow_runtime, "artifacts/shadow-runtime.json");
    assert.equal(result.report.artifacts.shadow_metrics, "artifacts/shadow-metrics.json");
    assert.ok(existsSync(join(outputDir, "artifacts", "review-memory.json")));
    assert.ok(existsSync(join(outputDir, "artifacts", "policy-dsl")));
    assert.ok(existsSync(join(outputDir, "artifacts", "shadow-runtime.json")));
    assert.ok(existsSync(join(outputDir, "artifacts", "shadow-metrics.json")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("demo report output is deterministic with fixed generated_at", () => {
  const firstRoot = tempRoot();
  const secondRoot = tempRoot();
  try {
    for (const root of [firstRoot, secondRoot]) {
      for (const item of [1, 2, 3]) {
        writeRecord(
          join(root, "records", "openclaw-openclaw", "items", `${item}.md`),
          `---
labels: bug
decision: keep_open
---
`,
        );
      }
    }

    const first = runFixture(firstRoot);
    const second = runFixture(secondRoot);

    assert.deepEqual(first.report, second.report);
    assert.equal(
      readFileSync(first.markdownPath, "utf8"),
      readFileSync(second.markdownPath, "utf8"),
    );
  } finally {
    rmSync(firstRoot, { recursive: true, force: true });
    rmSync(secondRoot, { recursive: true, force: true });
  }
});

test("demo report does not call GitHub or network APIs", () => {
  const root = tempRoot();
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (() => {
      throw new Error("network should not be called");
    }) as typeof fetch;

    assert.doesNotThrow(() => runFixture(root));
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(root, { recursive: true, force: true });
  }
});

test("demo report does not call guarded execution", () => {
  const root = tempRoot();
  try {
    const result = runFixture(root);

    assert.equal(result.report.safety_boundary.guarded_execution, false);
    assert.equal(existsSync(join(root, "results", "guarded-execution")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
