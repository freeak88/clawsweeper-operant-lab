import type { ManualPrGuideGeneratorOptions, ManualPrGuideJson } from "./types.js";

const DO_NOT_DO = [
  "do not push without final operator review",
  "do not create PR without reviewing body",
  "do not bypass validation",
  "do not merge automatically",
].sort();

const SAFETY_NOTE =
  "This guide is artifact-only. It did not run git, gh, push, create a PR, call GitHub APIs, mutate source files, or change scheduler/apply/automerge behavior.";

export function generateManualPrGuide(options: ManualPrGuideGeneratorOptions): ManualPrGuideJson {
  const prPackage = parsePrPackage(options.prPackage);
  const branchIntent = parseBranchIntent(options.branchIntent);
  const commitExecution = parseCommitExecution(options.commitExecution);
  const packageId = prPackage?.pr_package_id ?? sourceIdFrom(options.prPackage);
  const branchName = branchIntent?.proposed_branch_name ?? "";
  const commitHash = prPackage?.commit_hash || commitExecution?.commit_hash || "";
  const prTitle = prPackage?.title ?? "";
  const prBody = prPackage?.body ?? "";
  const rollbackSteps = rollbackStepsFor(prPackage, commitExecution);
  const riskChecklist = riskChecklistFor(prPackage);
  const prePushChecklist = prePushChecklistFor(prPackage, branchName, commitHash);
  const manualSteps = manualStepsFor(branchName, prTitle);

  if (prPackage?.status === "needs_review") {
    return guide({
      packageId,
      status: "needs_review",
      branchName,
      commitHash,
      prTitle,
      prBody,
      manualSteps,
      prePushChecklist,
      riskChecklist,
      rollbackSteps,
      blockedReason: "PR package requires human review",
    });
  }

  const failure = !prPackage
    ? "PR package is missing or malformed"
    : prPackage.status !== "ready"
      ? `PR package status is not ready: ${prPackage.status}`
      : !branchIntent
        ? "branch creation intent is missing or malformed"
        : branchIntent.status !== "ready"
          ? `branch creation intent status is not ready: ${branchIntent.status}`
          : !branchName
            ? "branch name is missing"
            : !commitExecution
              ? "commit execution is missing or malformed"
              : commitExecution.status !== "committed"
                ? `commit execution status is not committed: ${commitExecution.status}`
                : !commitHash
                  ? "commit hash is missing"
                  : !prTitle
                    ? "PR title is missing"
                    : !prBody
                      ? "PR body is missing"
                      : null;

  if (failure) {
    return guide({
      packageId,
      status: "blocked",
      branchName,
      commitHash,
      prTitle,
      prBody,
      manualSteps,
      prePushChecklist,
      riskChecklist,
      rollbackSteps,
      blockedReason: failure,
    });
  }

  return guide({
    packageId,
    status: "ready",
    branchName,
    commitHash,
    prTitle,
    prBody,
    manualSteps,
    prePushChecklist,
    riskChecklist,
    rollbackSteps,
    blockedReason: null,
  });
}

export function renderManualPrGuideMarkdown(guide: ManualPrGuideJson): string {
  return [
    "# Manual PR Creation Guide",
    "",
    "> The system prepares; the operator decides. This guide is artifact-only and does not execute remote action.",
    "",
    "## Summary",
    "",
    `- Guide id: \`${guide.guide_id}\``,
    `- Status: \`${guide.status}\``,
    `- Branch name: \`${guide.branch_name || "none"}\``,
    `- Commit hash: \`${guide.commit_hash || "none"}\``,
    `- PR title: ${guide.pr_title || "none"}`,
    `- Recommended next step: \`${guide.recommended_next_step}\``,
    guide.blocked_reason ? `- Blocked reason: ${guide.blocked_reason}` : "- Blocked reason: none",
    "",
    "## Manual Steps",
    "",
    bulletList(guide.manual_steps),
    "",
    "## Pre-push Checklist",
    "",
    bulletList(guide.pre_push_checklist),
    "",
    "## Risk Acceptance Checklist",
    "",
    bulletList(guide.risk_acceptance_checklist),
    "",
    "## Rollback Steps",
    "",
    bulletList(guide.rollback_steps),
    "",
    "## Do Not Do",
    "",
    bulletList(guide.do_not_do),
    "",
    "## PR Body",
    "",
    guide.pr_body || "No PR body available.",
    "",
    "## Safety Boundary",
    "",
    SAFETY_NOTE,
    "",
  ].join("\n");
}

interface ParsedPrPackage {
  pr_package_id: string;
  status: string;
  commit_hash: string;
  title: string;
  body: string;
  rollback_plan: string[];
  risk_notes: string[];
  operator_checklist: string[];
}

interface ParsedBranchIntent {
  branch_intent_id: string;
  status: string;
  proposed_branch_name: string;
}

interface ParsedCommitExecution {
  commit_intent_id: string;
  status: string;
  commit_hash: string;
  rollback_instruction: string;
}

function guide(options: {
  packageId: string;
  status: "ready" | "blocked" | "needs_review";
  branchName: string;
  commitHash: string;
  prTitle: string;
  prBody: string;
  manualSteps: string[];
  prePushChecklist: string[];
  riskChecklist: string[];
  rollbackSteps: string[];
  blockedReason: string | null;
}): ManualPrGuideJson {
  return {
    guide_id: `manual-pr-guide-${sanitizeSegment(options.packageId || "unknown")}`,
    status: options.status,
    branch_name: options.branchName,
    commit_hash: options.commitHash,
    pr_title: options.prTitle,
    pr_body: options.prBody,
    manual_steps: sortedUnique(options.manualSteps),
    pre_push_checklist: sortedUnique(options.prePushChecklist),
    risk_acceptance_checklist: sortedUnique(options.riskChecklist),
    rollback_steps: sortedUnique(options.rollbackSteps),
    do_not_do: DO_NOT_DO,
    recommended_next_step:
      options.status === "ready"
        ? "operator_manual_pr_creation"
        : options.status === "needs_review"
          ? "request_human_review"
          : "stop",
    blocked_reason: options.blockedReason,
  };
}

function parsePrPackage(value: unknown): ParsedPrPackage | undefined {
  if (!isObject(value)) return undefined;
  if (typeof value.pr_package_id !== "string" || !value.pr_package_id) return undefined;
  if (typeof value.status !== "string") return undefined;
  return {
    pr_package_id: value.pr_package_id,
    status: value.status,
    commit_hash: stringValue(value.commit_hash),
    title: stringValue(value.title),
    body: stringValue(value.body),
    rollback_plan: stringArray(value.rollback_plan),
    risk_notes: stringArray(value.risk_notes),
    operator_checklist: stringArray(value.operator_checklist),
  };
}

function parseBranchIntent(value: unknown): ParsedBranchIntent | undefined {
  if (!isObject(value)) return undefined;
  if (typeof value.branch_intent_id !== "string" || !value.branch_intent_id) return undefined;
  if (typeof value.status !== "string") return undefined;
  return {
    branch_intent_id: value.branch_intent_id,
    status: value.status,
    proposed_branch_name: stringValue(value.proposed_branch_name),
  };
}

function parseCommitExecution(value: unknown): ParsedCommitExecution | undefined {
  if (!isObject(value)) return undefined;
  if (typeof value.commit_intent_id !== "string" || !value.commit_intent_id) return undefined;
  if (typeof value.status !== "string") return undefined;
  return {
    commit_intent_id: value.commit_intent_id,
    status: value.status,
    commit_hash: stringValue(value.commit_hash),
    rollback_instruction: stringValue(value.rollback_instruction),
  };
}

function manualStepsFor(branchName: string, prTitle: string): string[] {
  return [
    "Review the PR package markdown and JSON artifacts.",
    branchName ? `Confirm the local branch is ${branchName}.` : "Confirm the local branch name.",
    "Inspect the local commit and changed files manually.",
    prTitle ? `Use the prepared PR title: ${prTitle}` : "Review the prepared PR title.",
    "Use the prepared PR body only after reading it end to end.",
    "Create the remote PR manually only after completing every checklist item.",
  ];
}

function prePushChecklistFor(
  prPackage: ParsedPrPackage | undefined,
  branchName: string,
  commitHash: string,
): string[] {
  return [
    "Confirm the working tree is clean before any manual push.",
    branchName ? `Confirm branch name: ${branchName}` : "Confirm branch name is present.",
    commitHash
      ? `Confirm local commit hash: ${commitHash}`
      : "Confirm local commit hash is present.",
    "Confirm validation evidence in the PR package is still current.",
    ...(prPackage?.operator_checklist ?? []),
  ];
}

function riskChecklistFor(prPackage: ParsedPrPackage | undefined): string[] {
  return [
    "Accept that remote action is manual and operator-owned.",
    "Confirm rollback is understood before any push.",
    "Confirm no automatic merge will be enabled.",
    ...(prPackage?.risk_notes ?? []),
  ];
}

function rollbackStepsFor(
  prPackage: ParsedPrPackage | undefined,
  commitExecution: ParsedCommitExecution | undefined,
): string[] {
  return sortedUnique([
    commitExecution?.rollback_instruction ?? "",
    ...(prPackage?.rollback_plan ?? []),
  ]);
}

function sourceIdFrom(value: unknown): string {
  if (isObject(value) && typeof value.pr_package_id === "string" && value.pr_package_id) {
    return value.pr_package_id;
  }
  return "unknown";
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").sort()
    : [];
}

function sanitizeSegment(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9/-]+/g, "-")
    .replaceAll(/\/+/g, "/")
    .replaceAll(/-+/g, "-")
    .replace(/^[-/]+|[-/]+$/g, "");
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function bulletList(items: readonly string[]): string {
  if (items.length === 0) return "- none";
  return items.map((item) => `- ${item}`).join("\n");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
