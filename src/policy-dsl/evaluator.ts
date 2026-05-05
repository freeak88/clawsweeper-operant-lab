import type { ReviewMemoryIndex, ReviewMemoryItem } from "../review-memory/types.js";
import type {
  PolicyCondition,
  PolicyDryRunReport,
  PolicyEvaluationResult,
  PolicyDslRule,
} from "./types.js";

type PolicyItem = Record<string, unknown> | ReviewMemoryItem;

export function evaluatePolicyDsl(policy: PolicyDslRule, item: PolicyItem): PolicyEvaluationResult {
  const matchedConditions: string[] = [];
  const failedConditions: string[] = [];

  for (const condition of policy.conditions) {
    const conditionLabel = renderCondition(condition);
    if (conditionMatches(condition, item)) {
      matchedConditions.push(conditionLabel);
    } else {
      failedConditions.push(conditionLabel);
    }
  }

  const matched = failedConditions.length === 0;
  return {
    policy_id: policy.policy_id,
    matched,
    would_action: policy.action.type,
    dry_run_only: true,
    matched_conditions: matchedConditions.sort(),
    failed_conditions: failedConditions.sort(),
    risks: risksFor(policy, matched),
  };
}

export function dryRunPolicyDsl(
  policy: PolicyDslRule,
  memory: ReviewMemoryIndex | ReviewMemoryItem | Record<string, unknown>,
): PolicyDryRunReport {
  const items = memoryItems(memory);
  const results = items
    .map((item) => evaluatePolicyDsl(policy, item))
    .sort(compareEvaluationResults);

  return {
    policy_id: policy.policy_id,
    dry_run_only: true,
    evaluated_count: results.length,
    matched_count: results.filter((result) => result.matched).length,
    results,
  };
}

function conditionMatches(condition: PolicyCondition, item: PolicyItem): boolean {
  const value = valueForField(item, condition.field);
  if (value === undefined || value === null) return condition.op === "not_exists";

  switch (condition.op) {
    case "equals":
      return value === condition.value;
    case "not_equals":
      return value !== condition.value;
    case "includes":
      return includesValue(value, condition.value);
    case "not_includes":
      return !includesValue(value, condition.value);
    case "exists":
      return existsValue(value);
    case "not_exists":
      return !existsValue(value);
    case "gte":
      return numericCompare(value, condition.value, (left, right) => left >= right);
    case "lte":
      return numericCompare(value, condition.value, (left, right) => left <= right);
  }
}

function includesValue(value: unknown, expected: unknown): boolean {
  if (Array.isArray(value)) return value.includes(expected);
  if (typeof value === "string" && typeof expected === "string") return value.includes(expected);
  return false;
}

function existsValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.length > 0;
  return value !== undefined && value !== null;
}

function numericCompare(
  value: unknown,
  expected: unknown,
  compare: (left: number, right: number) => boolean,
): boolean {
  if (typeof value !== "number" || typeof expected !== "number") return false;
  return compare(value, expected);
}

function renderCondition(condition: PolicyCondition): string {
  const value = condition.value === undefined ? "" : ` ${JSON.stringify(condition.value)}`;
  return `${condition.field} ${condition.op}${value}`;
}

function risksFor(policy: PolicyDslRule, matched: boolean): string[] {
  const risks = ["dry-run only; no action executed"];
  if (matched && policy.action.type !== "annotate_only") {
    risks.push(`would only propose ${policy.action.type}`);
  }
  return risks.sort();
}

function memoryItems(
  memory: ReviewMemoryIndex | ReviewMemoryItem | Record<string, unknown>,
): PolicyItem[] {
  if (isReviewMemoryIndex(memory)) {
    return [...memory.items].sort((left, right) => left.item_number - right.item_number);
  }
  return [memory as PolicyItem];
}

function valueForField(item: PolicyItem, field: string): unknown {
  return (item as Record<string, unknown>)[field];
}

function isReviewMemoryIndex(value: unknown): value is ReviewMemoryIndex {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { items?: unknown }).items)
  );
}

function compareEvaluationResults(
  left: PolicyEvaluationResult,
  right: PolicyEvaluationResult,
): number {
  if (left.matched !== right.matched) return left.matched ? -1 : 1;
  return JSON.stringify(left).localeCompare(JSON.stringify(right));
}
