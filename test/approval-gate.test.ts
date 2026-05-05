import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { evaluateApprovalGate, runApprovalGate } from "../dist/approval-gate/index.js";

const proposal = {
  proposal_id: "improve-scheduler-saturated_backlog-1234abcd",
  category: "scheduler",
  problem_summary: "Due backlog is saturating planned review capacity.",
  observed_signals: ["due backlog 72", "planned capacity 40"],
  proposed_change: "Prepare an operator-reviewed scheduler capacity proposal.",
  expected_benefit: "Reduce due backlog pressure without changing runtime capacity automatically.",
  risk_level: "medium",
  confidence_score: 0.82,
};

const approval = {
  proposal_id: proposal.proposal_id,
  approved: true,
  approved_by: "operator",
  approved_at: "2026-05-05T12:00:00.000Z",
  approval_scope: "implementation_plan_only",
  notes: "Approved for planning only.",
};

test("approval gate generates implementation plan for valid approval", () => {
  const output = evaluateApprovalGate({ proposal, approval });

  assert.equal(output.status, "approved_for_planning");
  if (output.status !== "approved_for_planning") throw new Error("expected plan");
  assert.equal(output.proposal_id, proposal.proposal_id);
  assert.equal(output.approval_scope, "implementation_plan_only");
  assert.ok(output.implementation_steps.length > 0);
  assert.ok(output.files_likely_changed.includes("src/adaptive-scheduler/"));
});

test("approval gate blocks missing approval", () => {
  const output = evaluateApprovalGate({ proposal });

  assert.equal(output.status, "blocked");
  if (output.status !== "blocked") throw new Error("expected blocked output");
  assert.match(output.blocked_reason, /missing or invalid operator approval/);
});

test("approval gate blocks approved false", () => {
  const output = evaluateApprovalGate({ proposal, approval: { ...approval, approved: false } });

  assert.equal(output.status, "blocked");
  if (output.status !== "blocked") throw new Error("expected blocked output");
  assert.match(output.blocked_reason, /approval is false/);
});

test("approval gate blocks wrong scope", () => {
  const output = evaluateApprovalGate({
    proposal,
    approval: { ...approval, approval_scope: "execute_change" },
  });

  assert.equal(output.status, "blocked");
  if (output.status !== "blocked") throw new Error("expected blocked output");
  assert.match(output.blocked_reason, /missing or invalid operator approval/);
});

test("approval gate missing proposal fields fail closed", () => {
  const output = evaluateApprovalGate({
    proposal: { ...proposal, proposed_change: undefined },
    approval,
  });

  assert.equal(output.status, "blocked");
  if (output.status !== "blocked") throw new Error("expected blocked output");
  assert.match(output.blocked_reason, /invalid improvement proposal/);
});

test("approval gate output is deterministic", () => {
  const first = evaluateApprovalGate({ proposal, approval });
  const second = evaluateApprovalGate({ proposal, approval });

  assert.deepEqual(first, second);
});

test("approval gate plan contains rollback and safety constraints", () => {
  const output = evaluateApprovalGate({ proposal, approval });

  assert.equal(output.status, "approved_for_planning");
  if (output.status !== "approved_for_planning") throw new Error("expected plan");
  assert.ok(output.rollback_plan.some((step) => step.includes("Revert")));
  assert.ok(output.safety_constraints.includes("Do not mutate GitHub."));
  assert.ok(output.safety_constraints.includes("Do not create PRs automatically."));
});

test("approval gate CLI writes deterministic output artifact", () => {
  const root = mkdtempSync(join(tmpdir(), "clawsweeper-approval-gate-"));
  try {
    const proposalPath = join(root, "proposal.json");
    const approvalPath = join(root, "approval.json");
    const outputRoot = join(root, "out");
    mkdirSync(root, { recursive: true });
    writeFileSync(proposalPath, `${JSON.stringify(proposal)}\n`, "utf8");
    writeFileSync(approvalPath, `${JSON.stringify(approval)}\n`, "utf8");

    const result = runApprovalGate({ proposalPath, approvalPath, outputRoot });
    const written = JSON.parse(readFileSync(result.outputPath, "utf8")) as { status: string };

    assert.equal(result.output.status, "approved_for_planning");
    assert.equal(written.status, "approved_for_planning");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
