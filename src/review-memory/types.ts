export type ReviewMemoryPatternType =
  | "label"
  | "verdict"
  | "repair_marker"
  | "conflict_type"
  | "safe_close_reason"
  | "automerge_cause"
  | "policy_rfc";

export interface ReviewMemoryPattern {
  pattern_type: ReviewMemoryPatternType;
  pattern_value: string;
  occurrences: number;
  distinct_items: number;
  source_records: string[];
}

export interface ReviewMemoryItem {
  item_number: number;
  target_repo: string;
  labels: string[];
  verdicts: string[];
  repair_markers: string[];
  conflict_types: string[];
  safe_close_reasons: string[];
  automerge_causes: string[];
  policy_rfc_refs: string[];
}

export interface ReviewMemoryIndex {
  schema_version: 1;
  generated_at: string;
  target_repo: string;
  summary: {
    record_count: number;
    item_count: number;
    pattern_count: number;
  };
  patterns: ReviewMemoryPattern[];
  items: ReviewMemoryItem[];
}

export interface BuildReviewMemoryOptions {
  recordsRoot: string;
  targetRepo: string;
  policyRfcRoot?: string | undefined;
  generatedAt?: string | undefined;
}

export interface WriteReviewMemoryOptions extends BuildReviewMemoryOptions {
  outputRoot: string;
}
