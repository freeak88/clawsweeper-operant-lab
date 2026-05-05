import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { sortStable } from "../stable-json.js";
import type {
  GuardedExecutionAction,
  GuardedExecutionDecision,
  GuardedExecutionInput,
  GuardedExecutionRunResult,
  GuardedPolicyInput,
  GuardedPolicyMetricsInput,
} from "./types.js";

const ALLOWED_ACTIONS: readonly GuardedExecutionAction[] = ["annotate_only", "suggest_comment"];

const SAFETY_CONSTRAINTS = [
  "no policy execution beyond local guarded decision logging",
  "no GitHub mutation",
  "no issue closing",
  "no PR merging",
  "no repair dispatch",
  "no repository state modification",
  "no scheduler/apply/automerge behavior change",
];

export function runGuardedExecution(options: {
  policyPath: string;
  metricsPath: string;
  confidencePath: string;
  itemNumber: number;
  dryRun?: boolean | undefined;
  outputRoot?: string | undefined;
  generatedAt?: string | undefined;
  enabled?: boolean | undefined;
}): GuardedExecutionRunResult {
  try {
    const policyPath = resolve(options.policyPath);
    const metricsPath = resolve(options.metricsPath);
    const confidencePath = resolve(options.confidencePath);
    if (!existsSync(policyPath)) return { ok: false, error: `Missing policy file: ${policyPath}` };
    if (!existsSync(metricsPath))
      return { ok: false, error: `Missing metrics file: ${metricsPath}` };
    if (!existsSync(confidencePath)) {
      return { ok: false, error: `Missing confidence file: ${confidencePath}` };
    }

    const policy = readJson(policyPath) as GuardedPolicyInput;
    const metrics = policyMetrics(readJson(metricsPath), policy.policy_id);
    const confidence = readJson(confidencePath) as GuardedExecutionInput["confidence"];
    const decision = evaluateGuardedExecution({
      policy,
      metrics,
      confidence,
      item_number: options.itemNumber,
      dry_run: options.dryRun ?? true,
      enabled: options.enabled ?? process.env.CLAWSWEEPER_ENABLE_GUARDED_EXECUTION === "1",
      generated_at: options.generatedAt,
    });
    const outputRoot = resolve(options.outputRoot ?? "results/guarded-execution");
    const outputPath = join(
      outputRoot,
      `${fileSafeTimestamp(decision.generated_at)}-${decision.policy_id}-${decision.item_number}.json`,
    );

    mkdirSync(outputRoot, { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(sortStable(decision), null, 2)}\n`);
    return { ok: true, decision, outputPath };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function evaluateGuardedExecution(input: GuardedExecutionInput): GuardedExecutionDecision {
  const generatedAt = input.generated_at ?? new Date().toISOString();
  const action = allowedAction(input.policy.action.type);
  const checks = [
    {
      ok: input.enabled === true,
      reason: "guarded execution flag CLAWSWEEPER_ENABLE_GUARDED_EXECUTION=1 is required",
    },
    { ok: input.dry_run !== true, reason: "dry_run=true prevents execution" },
    {
      ok: input.policy.status === "approved",
      reason: `policy status must be approved; got ${input.policy.status}`,
    },
    {
      ok: input.metrics.candidate_for_guarded_execution === true,
      reason: `policy is not a guarded candidate: ${input.metrics.candidate_reason ?? "no candidate reason"}`,
    },
    {
      ok: input.confidence.confidence_score >= 0.9,
      reason: `confidence_score below 0.9: ${input.confidence.confidence_score}`,
    },
    {
      ok: input.metrics.blocked_count === 0,
      reason: `blocked_count must be 0: ${input.metrics.blocked_count}`,
    },
    {
      ok: input.metrics.risk_count_by_policy === 0,
      reason: `risk_count_by_policy must be 0: ${input.metrics.risk_count_by_policy}`,
    },
    {
      ok: action !== undefined,
      reason: `action type is not allowed in v0.6: ${input.policy.action.type}`,
    },
  ];
  const failed = checks.find((check) => !check.ok);
  const executed = failed === undefined;
  const fullReasoning = [
    `policy_id=${input.policy.policy_id}`,
    `item_number=${input.item_number}`,
    `candidate_for_guarded_execution=${input.metrics.candidate_for_guarded_execution}`,
    `confidence_score=${input.confidence.confidence_score}`,
    `blocked_count=${input.metrics.blocked_count}`,
    `risk_count_by_policy=${input.metrics.risk_count_by_policy}`,
    `requested_action=${input.policy.action.type}`,
    `dry_run=${input.dry_run}`,
    `enabled=${input.enabled === true}`,
    ...(input.confidence.confidence_reasons ?? []).map((reason) => `confidence: ${reason}`),
    ...(input.confidence.blocking_risks ?? []).map((risk) => `blocking risk: ${risk}`),
  ].sort();

  return {
    schema_version: 1,
    generated_at: generatedAt,
    executed,
    dry_run: input.dry_run,
    action: executed ? (action ?? "none") : "none",
    reason: executed
      ? `guarded ${action} allowed for approved candidate policy`
      : (failed?.reason ?? "guarded execution denied"),
    policy_id: input.policy.policy_id,
    item_number: input.item_number,
    full_reasoning: fullReasoning,
    rollback_hint: executed
      ? "Revert by removing or ignoring this local guarded-execution log; no external state was changed."
      : "No rollback required; no guarded action was executed.",
    safety_constraints: SAFETY_CONSTRAINTS,
  };
}

function allowedAction(action: string): GuardedExecutionAction | undefined {
  return ALLOWED_ACTIONS.includes(action as GuardedExecutionAction)
    ? (action as GuardedExecutionAction)
    : undefined;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function policyMetrics(value: unknown, policyId: string): GuardedPolicyMetricsInput {
  if (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { policies?: unknown }).policies)
  ) {
    const match = (value as { policies: unknown[] }).policies.find(
      (policy) =>
        typeof policy === "object" &&
        policy !== null &&
        (policy as { policy_id?: unknown }).policy_id === policyId,
    );
    if (match) return match as GuardedPolicyMetricsInput;
  }
  return value as GuardedPolicyMetricsInput;
}

function fileSafeTimestamp(value: string): string {
  return value.replaceAll(":", "-").replaceAll(".", "-");
}
