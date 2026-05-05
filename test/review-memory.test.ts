import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildReviewMemoryIndex,
  findItemMemory,
  findMemoryPattern,
  writeReviewMemoryIndex,
} from "../dist/review-memory/index.js";

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), "clawsweeper-review-memory-"));
}

function writeFixture(path: string, content: string): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content, "utf8");
}

test("review memory indexer builds deterministic index from durable records", () => {
  const root = tempRoot();
  try {
    const recordsRoot = join(root, "records");
    writeFixture(
      join(recordsRoot, "openclaw-openclaw", "items", "1.md"),
      `---
labels: ["bug", "security"]
decision: keep_open
close_reason: implemented_on_main
work_candidate: queue_fix_pr
---

clawsweeper-verdict:needs_repair
Conflict type: package-lock
Automerge cause: validation-green
`,
    );
    writeFixture(
      join(recordsRoot, "openclaw-openclaw", "items", "2.json"),
      JSON.stringify({
        number: 2,
        repair_marker: "queue_fix_pr",
        conflict_type: "package-lock",
        automerge_cause: "validation-green",
      }),
    );

    const first = buildReviewMemoryIndex({
      recordsRoot,
      targetRepo: "openclaw/openclaw",
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    const second = buildReviewMemoryIndex({
      recordsRoot,
      targetRepo: "openclaw/openclaw",
      generatedAt: "2026-01-01T00:00:00.000Z",
    });

    assert.deepEqual(first, second);
    assert.equal(first.summary.record_count, 2);
    assert.equal(first.summary.item_count, 2);
    assert.equal(findMemoryPattern(first, "conflict_type", "package-lock")?.occurrences, 2);
    assert.deepEqual(findItemMemory(first, 1)?.labels, ["bug", "security"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("review memory query can find patterns by type and value", () => {
  const index = buildReviewMemoryIndex({
    recordsRoot: "missing-records",
    targetRepo: "openclaw/openclaw",
    generatedAt: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(findMemoryPattern(index, "label", "bug"), undefined);
});

test("review memory query can find item memory by item number", () => {
  const root = tempRoot();
  try {
    const recordsRoot = join(root, "records");
    writeFixture(
      join(recordsRoot, "openclaw-openclaw", "items", "42.md"),
      `---
labels: bug
review_status: complete
---
`,
    );

    const index = buildReviewMemoryIndex({
      recordsRoot,
      targetRepo: "openclaw/openclaw",
      generatedAt: "2026-01-01T00:00:00.000Z",
    });

    assert.equal(findItemMemory(index, 42)?.item_number, 42);
    assert.equal(findItemMemory(index, 7), undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("review memory tolerates malformed and old records", () => {
  const root = tempRoot();
  try {
    const recordsRoot = join(root, "records");
    writeFixture(
      join(recordsRoot, "openclaw-openclaw", "items", "1.md"),
      "---\nlabels: [nope\n---",
    );
    writeFixture(join(recordsRoot, "openclaw-openclaw", "legacy.md"), "old text without markers");

    assert.doesNotThrow(() =>
      buildReviewMemoryIndex({
        recordsRoot,
        targetRepo: "openclaw/openclaw",
        generatedAt: "2026-01-01T00:00:00.000Z",
      }),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("review memory empty record directories produce a valid empty index", () => {
  const root = tempRoot();
  try {
    const index = buildReviewMemoryIndex({
      recordsRoot: join(root, "records"),
      targetRepo: "openclaw/openclaw",
      generatedAt: "2026-01-01T00:00:00.000Z",
    });

    assert.deepEqual(index, {
      schema_version: 1,
      generated_at: "2026-01-01T00:00:00.000Z",
      target_repo: "openclaw/openclaw",
      summary: {
        record_count: 0,
        item_count: 0,
        pattern_count: 0,
      },
      patterns: [],
      items: [],
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("review memory includes Policy RFC proposal references", () => {
  const root = tempRoot();
  try {
    const recordsRoot = join(root, "records");
    const policyRfcRoot = join(root, "results", "policy-rfc");
    writeFixture(
      join(recordsRoot, "openclaw-openclaw", "items", "9.md"),
      `---
labels: security
---
`,
    );
    writeFixture(
      join(policyRfcRoot, "openclaw-openclaw", "policy-rfc-label-security.json"),
      JSON.stringify({
        id: "policy-rfc-label-security",
        title: "Prefer security reviews",
        evidence_items: [{ item: "#9" }],
      }),
    );

    const { index, outputPath } = writeReviewMemoryIndex({
      recordsRoot,
      policyRfcRoot,
      outputRoot: join(root, "results", "review-memory"),
      targetRepo: "openclaw/openclaw",
      generatedAt: "2026-01-01T00:00:00.000Z",
    });

    assert.ok(outputPath.endsWith(join("results", "review-memory", "openclaw-openclaw.json")));
    assert.equal(
      findMemoryPattern(index, "policy_rfc", "policy-rfc-label-security")?.occurrences,
      1,
    );
    assert.deepEqual(findItemMemory(index, 9)?.policy_rfc_refs, [
      "policy-rfc-label-security",
      "prefer security reviews",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
