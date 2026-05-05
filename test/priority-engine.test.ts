import assert from "node:assert/strict";
import test from "node:test";

import { scorePriority } from "../dist/priority-engine/index.js";

test("priority engine produces deterministic critical output for high-risk PRs", () => {
  const input = {
    repo: "openclaw/clawsweeper",
    repoWeight: 0.8,
    labels: ["bug", "security"],
    labelWeights: { security: 1 },
    itemType: "pull_request" as const,
    createdAt: "2026-05-03T00:00:00.000Z",
    updatedAt: "2026-05-04T00:00:00.000Z",
    staleAt: "2026-05-04T00:00:00.000Z",
    authorAssociation: "MEMBER",
    riskPathSignals: [{ path: ".github/workflows/sweep.yml", reason: "workflow mutation" }],
    now: "2026-05-04T00:00:00.000Z",
  };

  assert.deepEqual(scorePriority(input), scorePriority(input));
  assert.deepEqual(scorePriority(input), {
    priority_score: 1,
    priority_band: "critical",
    priority_reasons: [
      "activity within 1 day",
      "label security weight 1.00",
      "new item",
      "priority label bug",
      "pull request review surface",
      "repo weight 0.80",
      "risk path .github/workflows/sweep.yml (workflow mutation)",
      "stale threshold reached",
      "trusted author association MEMBER",
    ],
  });
});

test("priority engine tolerates missing fields", () => {
  assert.deepEqual(scorePriority({}), {
    priority_score: 0.15,
    priority_band: "low",
    priority_reasons: [
      "missing author association",
      "missing item age timestamp",
      "missing item type",
      "missing recent activity timestamp",
      "no labels",
    ],
  });
});

test("priority engine rejects one-off noise into normal or low bands", () => {
  const result = scorePriority({
    labels: ["question"],
    itemType: "issue",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-10T00:00:00.000Z",
    authorAssociation: "NONE",
    now: "2026-05-04T00:00:00.000Z",
  });

  assert.equal(result.priority_band, "low");
  assert.equal(result.priority_score, 0.234);
  assert.ok(result.priority_reasons.includes("labels have no priority weight"));
});

test("priority engine uses explicit label and risk weights when provided", () => {
  const result = scorePriority({
    repoWeight: 0.2,
    labels: ["customer-impact"],
    labelWeights: { "customer-impact": 0.7 },
    itemType: "issue",
    createdAt: "2026-04-20T00:00:00.000Z",
    updatedAt: "2026-05-02T00:00:00.000Z",
    authorAssociation: "CONTRIBUTOR",
    riskPathSignals: [{ path: "src/repair/apply-result.ts", weight: 0.95 }],
    now: "2026-05-04T00:00:00.000Z",
  });

  assert.equal(result.priority_band, "high");
  assert.equal(result.priority_score, 0.747);
  assert.ok(result.priority_reasons.includes("label customer-impact weight 0.70"));
  assert.ok(result.priority_reasons.includes("risk path src/repair/apply-result.ts weight 0.95"));
});

test("priority bands map stable score thresholds", () => {
  assert.equal(
    scorePriority({ repoWeight: 0, now: "2026-05-04T00:00:00.000Z" }).priority_band,
    "low",
  );
  assert.equal(
    scorePriority({
      repoWeight: 0.5,
      labels: ["bug"],
      itemType: "issue",
      updatedAt: "2026-05-01T00:00:00.000Z",
      now: "2026-05-04T00:00:00.000Z",
    }).priority_band,
    "normal",
  );
  assert.equal(
    scorePriority({
      repoWeight: 0.9,
      labels: ["regression"],
      itemType: "pull_request",
      updatedAt: "2026-05-04T00:00:00.000Z",
      riskPathSignals: [{ path: "src/clawsweeper.ts" }],
      now: "2026-05-04T00:00:00.000Z",
    }).priority_band,
    "high",
  );
});
