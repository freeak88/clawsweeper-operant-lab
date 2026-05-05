import type { PolicyActionType, PolicyConditionOperator, PolicyDslRule } from "./types.js";

const CONDITION_OPERATORS = new Set<PolicyConditionOperator>([
  "equals",
  "not_equals",
  "includes",
  "not_includes",
  "exists",
  "not_exists",
  "gte",
  "lte",
]);

const ACTION_TYPES = new Set<PolicyActionType>([
  "propose_close",
  "propose_repair",
  "propose_automerge",
  "annotate_only",
]);

export function parsePolicyDsl(input: unknown): PolicyDslRule {
  if (!isRecord(input)) throw new Error("Policy DSL must be a JSON object");
  const policyId = stringField(input, "policy_id");
  const status = stringField(input, "status");
  if (status !== "approved") {
    throw new Error("Policy DSL status must be approved for dry-run evaluation");
  }

  const conditions = input.conditions;
  if (!Array.isArray(conditions) || conditions.length === 0) {
    throw new Error("Policy DSL requires at least one condition");
  }

  const parsedConditions = conditions.map((condition, index) => {
    if (!isRecord(condition)) {
      throw new Error(`Policy condition ${index} must be an object`);
    }
    const field = stringField(condition, "field");
    const op = stringField(condition, "op");
    if (!CONDITION_OPERATORS.has(op as PolicyConditionOperator)) {
      throw new Error(`Unsupported policy condition operator: ${op}`);
    }
    const needsValue = op !== "exists" && op !== "not_exists";
    if (needsValue && !isScalar(condition.value)) {
      throw new Error(`Policy condition ${index} requires a scalar value`);
    }
    const value = condition.value as string | number | boolean | undefined;
    return {
      field,
      op: op as PolicyConditionOperator,
      value: needsValue ? value : undefined,
    };
  });

  const action = input.action;
  if (!isRecord(action)) throw new Error("Policy DSL action must be an object");
  const actionType = stringField(action, "type");
  if (!ACTION_TYPES.has(actionType as PolicyActionType)) {
    throw new Error(`Unsupported policy action type: ${actionType}`);
  }
  if (action.mode !== "dry_run_only") {
    throw new Error("Policy DSL action mode must be dry_run_only");
  }

  return {
    policy_id: policyId,
    status: "approved",
    conditions: parsedConditions,
    action: {
      type: actionType as PolicyActionType,
      mode: "dry_run_only",
    },
  };
}

function stringField(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value === "string" && value.trim()) return value;
  throw new Error(`Policy DSL requires string field: ${field}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}
