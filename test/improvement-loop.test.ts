import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  detectOperationalWeaknesses,
  guardedPrSuggestionsFor,
  planImprovementProposals,
  runImprovementLoop,
  simulateImprovementProposals,
} from "../dist/improvement-loop/index.js";

const schedulerInput = {
  targetRepo: "openclaw/openclaw",
  lane: "normal_review",
  currentShardCount: 40,
  currentMinActiveShards: 20,
  currentBatchSize: 1,
  plannedCapacity: 40,
  dueBacklog: 72,
  capacityReason: "saturated: due backlog filled planned capacity",
};

const memory = {
  schema_version: 1,
  generated_at: "2026-05-05T12:00:00.000Z",
  target_repo: "openclaw/openclaw",
  summary: { record_count: 8, item_count: 8, pattern_count: 2 },
  patterns: [
    {
      pattern_type: "repair_marker",
      pattern_value: "successful-repair",
      occurrences: 5,
      distinct_items: 5,
      source_records: ["records/openclaw-openclaw/items/1.md"],
    },
    {
      pattern_type: "conflict_type",
      pattern_value: "changelog",
      occurrences: 4,
      distinct_items: 4,
      source_records: ["records/openclaw-openclaw/items/2.md"],
    },
  ],
  items: [],
} as const;

test("improvement loop detects saturated queues as scheduler proposals", () => {
  const weaknesses = detectOperationalWeaknesses({
    targetRepo: "openclaw/openclaw",
    scheduler: schedulerInput,
  });
  const proposals = planImprovementProposals(weaknesses);

  assert.ok(weaknesses.some((weakness) => weakness.weakness_type === "saturated_backlog"));
  assert.ok(proposals.some((proposal) => proposal.category === "scheduler"));
  assert.match(proposals[0]?.proposed_change ?? "", /operator-reviewed scheduler capacity/);
});

test("improvement loop detects repeated repair markers as policy proposals", () => {
  const weaknesses = detectOperationalWeaknesses({
    targetRepo: "openclaw/openclaw",
    reviewMemory: memory,
    minPatternOccurrences: 3,
  });
  const proposals = planImprovementProposals(weaknesses);

  assert.ok(weaknesses.some((weakness) => weakness.weakness_type === "repeated_repair_marker"));
  assert.ok(proposals.some((proposal) => proposal.category === "policy"));
});

test("improvement loop turns low-confidence patterns into guarded suggestions", () => {
  const weaknesses = detectOperationalWeaknesses({
    targetRepo: "openclaw/openclaw",
    confidenceResults: [
      {
        confidence_target: "safe_close",
        confidence_score: 0.28,
        confidence_band: "low",
        suggested_action: "require_human_review",
        confidence_reasons: ["snapshot drift unknown"],
        blocking_risks: [],
      },
    ],
  });
  const suggestions = guardedPrSuggestionsFor(planImprovementProposals(weaknesses));

  assert.equal(weaknesses[0]?.weakness_type, "low_confidence_pattern");
  assert.match(suggestions[0]?.summary ?? "", /observe mode|confidence evidence/);
  assert.ok(suggestions[0]?.safety_notes.includes("No GitHub mutation."));
});

test("improvement loop shadow simulation is deterministic", () => {
  const proposals = planImprovementProposals(
    detectOperationalWeaknesses({
      targetRepo: "openclaw/openclaw",
      scheduler: schedulerInput,
      reviewMemory: memory,
    }),
  );

  assert.deepEqual(
    simulateImprovementProposals(proposals),
    simulateImprovementProposals(proposals),
  );
});

test("improvement loop tolerates missing data", () => {
  assert.doesNotThrow(() =>
    detectOperationalWeaknesses({
      targetRepo: "openclaw/openclaw",
    }),
  );
  assert.deepEqual(detectOperationalWeaknesses({ targetRepo: "openclaw/openclaw" }), []);
});

test("improvement loop generated PR suggestions remain proposal-only", () => {
  const suggestions = guardedPrSuggestionsFor(
    planImprovementProposals(
      detectOperationalWeaknesses({
        targetRepo: "openclaw/openclaw",
        scheduler: { ...schedulerInput, failedShardCount: 5 },
      }),
    ),
  );

  assert.ok(suggestions.length > 0);
  assert.ok(suggestions.every((suggestion) => suggestion.summary.includes("no PR is created")));
  assert.ok(
    suggestions.every((suggestion) =>
      suggestion.safety_notes.includes("No scheduler/apply/automerge behavior change."),
    ),
  );
});

test("improvement loop output is deterministic with fixed clock", () => {
  const firstRoot = mkdtempSync(join(tmpdir(), "clawsweeper-improvement-loop-a-"));
  const secondRoot = mkdtempSync(join(tmpdir(), "clawsweeper-improvement-loop-b-"));
  try {
    const input = {
      targetRepo: "openclaw/openclaw",
      scheduler: schedulerInput,
      reviewMemory: memory,
      generatedAt: "2026-05-05T12:00:00.000Z",
    };
    const first = runImprovementLoop({ input, outputRoot: firstRoot });
    const second = runImprovementLoop({ input, outputRoot: secondRoot });

    assert.deepEqual(first.report, second.report);
    assert.equal(first.report.summary.executed_count, 0);
    assert.equal(first.report.safety_boundary.github_mutation, false);
    assert.equal(first.report.safety_boundary.autonomous_merge, false);
  } finally {
    rmSync(firstRoot, { recursive: true, force: true });
    rmSync(secondRoot, { recursive: true, force: true });
  }
});
