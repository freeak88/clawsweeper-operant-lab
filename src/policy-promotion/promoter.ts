import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import { sortStable } from "../stable-json.js";
import type {
  PolicyPromotionEvent,
  PolicyPromotionRecord,
  PolicyPromotionStatus,
  PromotePolicyOptions,
  PromotionFileResult,
} from "./types.js";

const VALID_TRANSITIONS: ReadonlyMap<PolicyPromotionStatus, readonly PolicyPromotionStatus[]> =
  new Map([
    ["draft", ["candidate"]],
    ["candidate", ["approved", "rejected"]],
    ["approved", ["superseded"]],
    ["rejected", []],
    ["superseded", []],
  ]);

const STATUSES = new Set<PolicyPromotionStatus>([
  "draft",
  "candidate",
  "approved",
  "rejected",
  "superseded",
]);

export function isPolicyPromotionStatus(value: string): value is PolicyPromotionStatus {
  return STATUSES.has(value as PolicyPromotionStatus);
}

export function normalizeProposalStatus(value: unknown): PolicyPromotionStatus {
  if (typeof value !== "string") return "draft";
  const normalized = value.trim().toLowerCase();
  return isPolicyPromotionStatus(normalized) ? normalized : "draft";
}

export function canPromotePolicy(
  fromStatus: PolicyPromotionStatus,
  toStatus: PolicyPromotionStatus,
): boolean {
  return VALID_TRANSITIONS.get(fromStatus)?.includes(toStatus) ?? false;
}

export function promotePolicyProposal(options: PromotePolicyOptions): PolicyPromotionRecord {
  const proposalId = proposalIdFrom(options.proposal);
  const now = options.now ?? new Date().toISOString();
  const fromStatus =
    options.existingRecord?.current_status ?? normalizeProposalStatus(options.proposal.status);

  if (!canPromotePolicy(fromStatus, options.toStatus)) {
    throw new Error(`Invalid policy promotion transition: ${fromStatus} -> ${options.toStatus}`);
  }

  const event: PolicyPromotionEvent = {
    from_status: fromStatus,
    to_status: options.toStatus,
    reason: options.reason,
    created_at: now,
  };
  if (options.operator_decision) event.operator_decision = options.operator_decision;
  if (options.confidence_metadata !== undefined) {
    event.confidence_metadata = options.confidence_metadata;
  }
  if (options.review_memory_evidence !== undefined) {
    event.review_memory_evidence = options.review_memory_evidence;
  }

  return {
    proposal_id: proposalId,
    current_status: options.toStatus,
    events: [...(options.existingRecord?.events ?? []), event],
    latest_reason: options.reason,
    updated_at: now,
  };
}

export function runPolicyPromotionFromFile(options: {
  proposalPath: string;
  toStatus: PolicyPromotionStatus;
  reason: string;
  outputRoot?: string | undefined;
  now?: string | undefined;
  operatorDecision?: string | undefined;
  confidenceMetadataPath?: string | undefined;
  reviewMemoryEvidencePath?: string | undefined;
}): PromotionFileResult {
  try {
    const proposalPath = resolve(options.proposalPath);
    if (!existsSync(proposalPath)) {
      return { ok: false, error: `Missing proposal file: ${proposalPath}` };
    }

    const proposal = readJson(proposalPath) as { id?: unknown; status?: unknown };
    const proposalId = proposalIdFrom(proposal);
    const outputRoot = resolve(options.outputRoot ?? "results/policy-promotions");
    const outputPath = join(outputRoot, `${proposalId}.json`);
    const existingRecord = readPromotionRecord(outputPath);

    const record = promotePolicyProposal({
      proposal,
      existingRecord,
      toStatus: options.toStatus,
      reason: options.reason,
      now: options.now,
      operator_decision: options.operatorDecision,
      confidence_metadata: options.confidenceMetadataPath
        ? readJson(resolve(options.confidenceMetadataPath))
        : undefined,
      review_memory_evidence: options.reviewMemoryEvidencePath
        ? readJson(resolve(options.reviewMemoryEvidencePath))
        : undefined,
    });

    mkdirSync(outputRoot, { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(sortStable(record), null, 2)}\n`);
    return { ok: true, record, outputPath };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function proposalIdFrom(proposal: { id?: unknown }): string {
  if (typeof proposal.id === "string" && proposal.id.trim()) return proposal.id;
  throw new Error("Policy proposal JSON is missing required string field: id");
}

function readPromotionRecord(path: string): PolicyPromotionRecord | undefined {
  if (!existsSync(path)) return undefined;
  const parsed = readJson(path) as Partial<PolicyPromotionRecord>;
  if (
    typeof parsed.proposal_id !== "string" ||
    !isPolicyPromotionStatus(String(parsed.current_status)) ||
    !Array.isArray(parsed.events)
  ) {
    throw new Error(`Malformed existing promotion record: ${basename(path)}`);
  }
  return parsed as PolicyPromotionRecord;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}
