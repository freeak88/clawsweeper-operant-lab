import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  canPromotePolicy,
  promotePolicyProposal,
  runPolicyPromotionFromFile,
} from "../dist/policy-promotion/index.js";

const proposal = {
  id: "repair-marker-validation-fix",
  title: "Policy RFC: Repair Marker - validation-fix",
  status: "Draft",
};

test("policy promotion accepts valid lifecycle transitions", () => {
  const candidate = promotePolicyProposal({
    proposal,
    toStatus: "candidate",
    reason: "repeated stable pattern",
    now: "2026-05-05T00:00:00.000Z",
  });
  assert.equal(candidate.current_status, "candidate");
  assert.equal(candidate.events.length, 1);
  assert.equal(candidate.events[0]?.from_status, "draft");

  const approved = promotePolicyProposal({
    proposal,
    existingRecord: candidate,
    toStatus: "approved",
    reason: "operator accepted policy candidate",
    now: "2026-05-06T00:00:00.000Z",
  });
  assert.equal(approved.current_status, "approved");
  assert.equal(approved.events.length, 2);

  const superseded = promotePolicyProposal({
    proposal,
    existingRecord: approved,
    toStatus: "superseded",
    reason: "newer policy covers this pattern",
    now: "2026-05-07T00:00:00.000Z",
  });
  assert.equal(superseded.current_status, "superseded");
  assert.equal(superseded.events.length, 3);
});

test("policy promotion rejects invalid transitions", () => {
  assert.equal(canPromotePolicy("rejected", "approved"), false);
  assert.throws(
    () =>
      promotePolicyProposal({
        proposal: { ...proposal, status: "Rejected" },
        toStatus: "approved",
        reason: "do not allow rejected to approved directly",
        now: "2026-05-05T00:00:00.000Z",
      }),
    /Invalid policy promotion transition: rejected -> approved/,
  );
});

test("policy promotion preserves immutable event history", () => {
  const existingRecord = {
    proposal_id: proposal.id,
    current_status: "candidate" as const,
    latest_reason: "repeated stable pattern",
    updated_at: "2026-05-05T00:00:00.000Z",
    events: [
      {
        from_status: "draft" as const,
        to_status: "candidate" as const,
        reason: "repeated stable pattern",
        created_at: "2026-05-05T00:00:00.000Z",
      },
    ],
  };

  const approved = promotePolicyProposal({
    proposal,
    existingRecord,
    toStatus: "approved",
    reason: "operator accepted policy candidate",
    now: "2026-05-06T00:00:00.000Z",
  });

  assert.deepEqual(approved.events[0], existingRecord.events[0]);
  assert.equal(approved.events[1]?.from_status, "candidate");
  assert.equal(approved.latest_reason, "operator accepted policy candidate");
});

test("policy promotion handles missing proposal files cleanly", () => {
  const root = mkdtempSync(join(tmpdir(), "clawsweeper-policy-promotion-"));
  try {
    const result = runPolicyPromotionFromFile({
      proposalPath: join(root, "missing.json"),
      toStatus: "candidate",
      reason: "repeated stable pattern",
      outputRoot: join(root, "out"),
      now: "2026-05-05T00:00:00.000Z",
    });

    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /Missing proposal file/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("policy promotion writes deterministic output shape", () => {
  const root = mkdtempSync(join(tmpdir(), "clawsweeper-policy-promotion-"));
  try {
    const proposalPath = join(root, "proposal.json");
    const outputRoot = join(root, "results");
    mkdirSync(root, { recursive: true });
    writeFileSync(proposalPath, `${JSON.stringify(proposal)}\n`);

    const result = runPolicyPromotionFromFile({
      proposalPath,
      toStatus: "candidate",
      reason: "repeated stable pattern",
      outputRoot,
      now: "2026-05-05T00:00:00.000Z",
      operatorDecision: "manual review accepted candidate",
    });

    assert.equal(result.ok, true);
    assert.equal(result.outputPath, join(outputRoot, `${proposal.id}.json`));
    assert.deepEqual(result.record, {
      proposal_id: proposal.id,
      current_status: "candidate",
      events: [
        {
          from_status: "draft",
          to_status: "candidate",
          reason: "repeated stable pattern",
          created_at: "2026-05-05T00:00:00.000Z",
          operator_decision: "manual review accepted candidate",
        },
      ],
      latest_reason: "repeated stable pattern",
      updated_at: "2026-05-05T00:00:00.000Z",
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
