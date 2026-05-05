import type { PolicyDslRule } from "../policy-dsl/types.js";
import type { ReviewMemoryIndex } from "../review-memory/types.js";
import type { ShadowMetricsReport } from "../shadow-metrics/types.js";
import type { ShadowRuntimeReport } from "../shadow-runtime/types.js";

export interface NormalizedDemoRepo {
  owner: string;
  repo: string;
  target_repo: string;
  repo_slug: string;
}

export interface DemoReportOptions {
  repoInput: string;
  outputRoot: string;
  recordsRoot: string;
  policyRfcRoot: string;
  maxRecords: number;
  minOccurrences: number;
  generatedAt?: string | undefined;
}

export interface DemoReportArtifacts {
  review_memory?: string | undefined;
  policy_rfc_dir?: string | undefined;
  policy_dsl_dir?: string | undefined;
  policy_dsl?: string | undefined;
  policy_dsl_dry_run?: string | undefined;
  shadow_runtime?: string | undefined;
  shadow_metrics?: string | undefined;
}

export interface DemoReportJson {
  schema_version: 1;
  generated_at: string;
  target_repo: string;
  input: {
    repo_url: string;
    record_count: number;
  };
  summary: {
    pattern_count: number;
    policy_rfc_count: number;
    shadow_match_count: number;
    candidate_policy_count: number;
    executed_count: 0;
  };
  decision: {
    executed: false;
    reason: "report-only demo generation";
  };
  safety_boundary: DemoReportSafetyBoundary;
  artifacts: DemoReportArtifacts;
}

export interface DemoReportSafetyBoundary {
  github_mutation: false;
  execution_enabled: false;
  guarded_execution: false;
  repair_dispatch: false;
  issue_close: false;
  pr_merge: false;
}

export interface DemoReportRunResult {
  repo: NormalizedDemoRepo;
  outputDir: string;
  markdownPath: string;
  jsonPath: string;
  report: DemoReportJson;
  memory?: ReviewMemoryIndex | undefined;
  demoPolicy?: PolicyDslRule | undefined;
  shadowRuntime?: ShadowRuntimeReport | undefined;
  shadowMetrics?: ShadowMetricsReport | undefined;
  warnings: string[];
}
