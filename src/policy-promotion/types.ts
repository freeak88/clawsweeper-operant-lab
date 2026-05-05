import type { PolicyProposalJson } from "../policy-rfc/types.js";

export type PolicyPromotionStatus = "draft" | "candidate" | "approved" | "rejected" | "superseded";

export interface PolicyPromotionEvidence {
  confidence_metadata?: unknown;
  review_memory_evidence?: unknown;
  operator_decision?: string | undefined;
}

export interface PolicyPromotionEvent extends PolicyPromotionEvidence {
  from_status: PolicyPromotionStatus;
  to_status: PolicyPromotionStatus;
  reason: string;
  created_at: string;
}

export interface PolicyPromotionRecord {
  proposal_id: string;
  current_status: PolicyPromotionStatus;
  events: PolicyPromotionEvent[];
  latest_reason: string;
  updated_at: string;
}

export interface PromotePolicyOptions extends PolicyPromotionEvidence {
  proposal: PolicyProposalJson | { id?: unknown; status?: unknown };
  toStatus: PolicyPromotionStatus;
  reason: string;
  now?: string | undefined;
  existingRecord?: PolicyPromotionRecord | undefined;
}

export interface PromotionFileResult {
  ok: boolean;
  record?: PolicyPromotionRecord | undefined;
  outputPath?: string | undefined;
  error?: string | undefined;
}
