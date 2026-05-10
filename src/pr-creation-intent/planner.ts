import type {
  PrCreationApprovalJson,
  PrCreationIntentJson,
  PrCreationIntentApprovalInput,
  PrCreationIntentPatchInput,
  PrCreationIntentShadowInput,
  PrCreationIntentValidationInput,
} from "./types.js";

const INTENT_SAFETY_CONSTRAINTS = [
  "Do not create a branch.",
  "Do not create commits.",
  "Do not create PRs.",
  "Do not merge.",
  "Do not mutate GitHub.",
  "Do not push branches.",
  "Do not apply patches.",
  "Do not modify source files from generated proposals.",
  "Do not change scheduler/apply/automerge behavior.",
].sort();

export function planPrCreationIntent(options: {
  patch: PrCreationIntentPatchInput | unknown;
  validation: PrCreationIntentValidationInput | unknown;
  shadow: PrCreationIntentShadowInput | unknown;
  approval: PrCreationIntentApprovalInput | unknown;
}): PrCreationIntentJson {
  const patchId = patchIdFrom(options.patch, options.validation, options.shadow, options.approval);
  const base = baseIntent(patchId);
  const patch = parsePatch(options.patch);
  const validationStatus = statusFrom(options.validation);
  const shadowStatus = statusFrom(options.shadow);
  const approval = parseApproval(options.approval, patchId);

  if (validationStatus === "needs_review") {
    return {
      ...base,
      status: "needs_review",
      operator_approval: approval ?? {},
      recommended_next_step: "request_human_review",
      blocked_reason: "patch validation requires human review",
    };
  }

  const blockedReason =
    blockedReasonForPatch(patch) ??
    blockedReasonForStatus("validation", validationStatus, "valid") ??
    blockedReasonForStatus("shadow execution", shadowStatus, "simulated") ??
    blockedReasonForApproval(options.approval, approval, patchId);

  if (blockedReason || !patch || !approval) {
    return {
      ...base,
      status: "blocked",
      operator_approval: approval ?? {},
      recommended_next_step: "stop",
      blocked_reason: blockedReason ?? "PR creation intent prerequisites were not satisfied",
    };
  }

  const filesExpected = sortedUnique([...patch.files_to_modify, ...patch.files_to_add]);
  const testsRequired = sortedUnique(patch.tests_to_run);
  const safetyConstraints = sortedUnique([
    ...patch.safety_constraints,
    ...INTENT_SAFETY_CONSTRAINTS,
  ]);
  const branchName = branchNameFor(patch.patch_id);
  const prTitle = `Supervised patch proposal: ${patch.proposal_id}`;

  return {
    intent_id: `pr-intent-${patch.patch_id}`,
    patch_id: patch.patch_id,
    status: "ready",
    branch_name: branchName,
    pr_title: prTitle,
    pr_body: prBodyFor({
      patch,
      approval,
      filesExpected,
      testsRequired,
      safetyConstraints,
    }),
    files_expected: filesExpected,
    tests_required: testsRequired,
    safety_constraints: safetyConstraints,
    operator_approval: approval,
    recommended_next_step: "ready_for_manual_pr_creation",
    blocked_reason: null,
  };
}

export function renderPrCreationIntentMarkdown(intent: PrCreationIntentJson): string {
  return [
    "# PR Creation Intent",
    "",
    "> Intent-only artifact. No branch, commit, push, PR, merge, patch application, source mutation, or GitHub mutation occurred.",
    "",
    "## Summary",
    "",
    `- Intent id: \`${intent.intent_id}\``,
    `- Patch id: \`${intent.patch_id}\``,
    `- Status: \`${intent.status}\``,
    `- Recommended next step: \`${intent.recommended_next_step}\``,
    intent.blocked_reason ? `- Blocked reason: ${intent.blocked_reason}` : "- Blocked reason: none",
    "",
    "## Proposed Manual PR",
    "",
    `- Branch name: \`${intent.branch_name || "none"}\``,
    `- PR title: ${intent.pr_title || "none"}`,
    "",
    "## Files Expected",
    "",
    bulletList(intent.files_expected),
    "",
    "## Tests Required",
    "",
    bulletList(intent.tests_required),
    "",
    "## Safety Constraints",
    "",
    bulletList(intent.safety_constraints),
    "",
    "## PR Body",
    "",
    intent.pr_body || "No PR body generated.",
    "",
    "## Safety Boundary",
    "",
    "- No branch was created.",
    "- No commits were created.",
    "- No push occurred.",
    "- No PR was created.",
    "- No merge occurred.",
    "- No GitHub state was mutated.",
    "- No patch was applied and no source files were modified from generated proposals.",
    "- Scheduler/apply/automerge behavior was not changed.",
    "",
  ].join("\n");
}

interface PatchForIntent {
  patch_id: string;
  proposal_id: string;
  status: "patch_proposed";
  summary: string;
  files_to_modify: string[];
  files_to_add: string[];
  tests_to_run: string[];
  safety_constraints: string[];
}

function parsePatch(value: unknown): PatchForIntent | undefined {
  if (!isObject(value)) return undefined;
  if (value.status !== "patch_proposed") return undefined;
  if (typeof value.patch_id !== "string" || !value.patch_id) return undefined;
  if (typeof value.proposal_id !== "string" || !value.proposal_id) return undefined;
  if (typeof value.summary !== "string") return undefined;
  if (!stringArray(value.files_to_modify)) return undefined;
  if (!stringArray(value.files_to_add)) return undefined;
  if (!stringArray(value.tests_to_run)) return undefined;
  if (!stringArray(value.safety_constraints)) return undefined;
  return {
    patch_id: value.patch_id,
    proposal_id: value.proposal_id,
    status: "patch_proposed",
    summary: value.summary,
    files_to_modify: value.files_to_modify,
    files_to_add: value.files_to_add,
    tests_to_run: value.tests_to_run,
    safety_constraints: value.safety_constraints,
  };
}

function parseApproval(value: unknown, patchId: string): PrCreationApprovalJson | undefined {
  if (!isObject(value)) return undefined;
  if (value.patch_id !== patchId) return undefined;
  if (value.approved !== true) return undefined;
  if (value.approval_scope !== "pr_creation_intent_only") return undefined;
  if (typeof value.approved_by !== "string" || !value.approved_by) return undefined;
  if (typeof value.approved_at !== "string" || !value.approved_at) return undefined;
  return {
    patch_id: patchId,
    approved: true,
    approved_by: value.approved_by,
    approved_at: value.approved_at,
    approval_scope: "pr_creation_intent_only",
    notes: typeof value.notes === "string" ? value.notes : "",
  };
}

function blockedReasonForPatch(patch: PatchForIntent | undefined): string | undefined {
  if (!patch) return "patch proposal is missing, malformed, or not patch_proposed";
  return undefined;
}

function blockedReasonForStatus(
  label: string,
  actual: string,
  expected: string,
): string | undefined {
  if (actual === expected) return undefined;
  return `${label} status is ${actual || "missing"}, expected ${expected}`;
}

function blockedReasonForApproval(
  rawApproval: unknown,
  approval: PrCreationApprovalJson | undefined,
  patchId: string,
): string | undefined {
  if (approval) return undefined;
  if (!isObject(rawApproval)) return "operator approval is missing or malformed";
  if (rawApproval.patch_id !== patchId) return "operator approval patch_id does not match patch";
  if (rawApproval.approved !== true) return "operator approval is not true";
  if (rawApproval.approval_scope !== "pr_creation_intent_only") {
    return "operator approval scope must be pr_creation_intent_only";
  }
  return "operator approval is malformed";
}

function baseIntent(patchId: string): PrCreationIntentJson {
  return {
    intent_id: `pr-intent-${patchId}`,
    patch_id: patchId,
    status: "blocked",
    branch_name: "",
    pr_title: "",
    pr_body: "",
    files_expected: [],
    tests_required: [],
    safety_constraints: INTENT_SAFETY_CONSTRAINTS,
    operator_approval: {},
    recommended_next_step: "stop",
    blocked_reason: null,
  };
}

function prBodyFor(options: {
  patch: PatchForIntent;
  approval: PrCreationApprovalJson;
  filesExpected: string[];
  testsRequired: string[];
  safetyConstraints: string[];
}): string {
  return [
    "## Summary",
    "",
    options.patch.summary,
    "",
    "This PR body was generated as an operator-approved creation intent only.",
    "",
    "## Operator Approval",
    "",
    `- Approved by: ${options.approval.approved_by}`,
    `- Approved at: ${options.approval.approved_at}`,
    `- Scope: ${options.approval.approval_scope}`,
    `- Notes: ${options.approval.notes || "none"}`,
    "",
    "## Files Expected",
    "",
    bulletList(options.filesExpected),
    "",
    "## Tests Required",
    "",
    bulletList(options.testsRequired),
    "",
    "## Safety Constraints",
    "",
    bulletList(options.safetyConstraints),
    "",
    "## Non-Goals",
    "",
    "- Do not create branches automatically.",
    "- Do not create commits automatically.",
    "- Do not push branches automatically.",
    "- Do not create PRs automatically.",
    "- Do not merge.",
    "- Do not mutate GitHub automatically.",
    "",
  ].join("\n");
}

function branchNameFor(patchId: string): string {
  return `operator/${sanitizeSegment(patchId)}`;
}

function sanitizeSegment(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9/-]+/g, "-")
    .replaceAll(/\/+/g, "/")
    .replaceAll(/-+/g, "-")
    .replace(/^[-/]+|[-/]+$/g, "");
}

function statusFrom(value: unknown): string {
  if (!isObject(value) || typeof value.status !== "string") return "missing";
  return value.status;
}

function patchIdFrom(...values: unknown[]): string {
  for (const value of values) {
    if (isObject(value) && typeof value.patch_id === "string" && value.patch_id)
      return value.patch_id;
  }
  return "unknown";
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function bulletList(items: readonly string[]): string {
  if (items.length === 0) return "- none";
  return items.map((item) => `- ${item}`).join("\n");
}
