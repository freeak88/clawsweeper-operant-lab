import type {
  BranchDryRunExecutorJson,
  BranchDryRunIntentInput,
  BranchDryRunSafetyCheck,
} from "./types.js";

const PROTECTED_EXACT = new Set(["main", "master", "develop"]);
const PROTECTED_PREFIXES = ["release/", "hotfix/"];

export function planBranchDryRunExecution(options: {
  branchIntent: BranchDryRunIntentInput | unknown;
}): BranchDryRunExecutorJson {
  const source = parseBranchIntent(options.branchIntent);
  const branchIntentId = source?.branch_intent_id ?? sourceIdFrom(options.branchIntent);
  const status = statusFrom(options.branchIntent);
  const baseRef = source ? sanitizeRef(source.base_ref) : "";
  const branchName = source ? sanitizeBranchName(source.proposed_branch_name) : "";
  const commandPreview =
    source && branchName && baseRef
      ? `git checkout -b ${quoteShellArg(branchName)} ${quoteShellArg(baseRef)}`
      : "";
  const checks: BranchDryRunSafetyCheck[] = [
    check("source branch intent is ready", source?.status === "ready"),
    check("base ref is explicit and sanitized", baseRef.length > 0),
    check("branch name is explicit and sanitized", branchName.length > 0),
    check("branch name is not protected", !isProtectedBranch(branchName)),
    check("command preview is deterministic", commandPreview.length > 0),
    check("executor is dry-run only", true),
  ];

  if (status === "needs_review") {
    return preview({
      branchIntentId,
      status: "needs_review",
      commandPreview,
      checks,
      blockedReason: "source branch creation intent requires human review",
    });
  }

  const failed = checks.find((item) => !item.passed);
  if (!source || source.status === "blocked" || failed) {
    return preview({
      branchIntentId,
      status: "blocked",
      commandPreview,
      checks,
      blockedReason:
        source?.blocked_reason ??
        failed?.message ??
        "source branch creation intent is missing or malformed",
    });
  }

  return preview({
    branchIntentId,
    status: "ready",
    commandPreview,
    checks,
    blockedReason: null,
  });
}

export function renderBranchDryRunExecutorMarkdown(preview: BranchDryRunExecutorJson): string {
  return [
    "# Guarded Branch Creation Dry-run Executor",
    "",
    "> Dry-run command preview only. No git command was executed, no branch was created, no checkout occurred, no commit was created, no push occurred, no PR was created, and no GitHub or source state was mutated.",
    "",
    "## Summary",
    "",
    `- Execution preview id: \`${preview.execution_preview_id}\``,
    `- Branch intent id: \`${preview.branch_intent_id || "unknown"}\``,
    `- Status: \`${preview.status}\``,
    `- Allowed command preview: \`${preview.allowed_command_preview || "none"}\``,
    `- Would execute: \`${String(preview.would_execute)}\``,
    `- Recommended next step: \`${preview.recommended_next_step}\``,
    preview.blocked_reason
      ? `- Blocked reason: ${preview.blocked_reason}`
      : "- Blocked reason: none",
    "",
    "## Safety Checks",
    "",
    ...preview.safety_checks.map((item) =>
      [`- ${item.passed ? "PASS" : "FAIL"}: ${item.check}`, `  - ${item.message}`].join("\n"),
    ),
    "",
    "## Safety Boundary",
    "",
    "- No git command was executed.",
    "- No branch was created.",
    "- No checkout occurred.",
    "- No commits were created.",
    "- No push occurred.",
    "- No PR was created.",
    "- No GitHub API calls were made.",
    "- No GitHub or source state was mutated.",
    "",
  ].join("\n");
}

interface ParsedBranchIntent {
  branch_intent_id: string;
  status: "ready" | "blocked" | "needs_review";
  base_ref: string;
  proposed_branch_name: string;
  blocked_reason: string | null;
}

function parseBranchIntent(value: unknown): ParsedBranchIntent | undefined {
  if (!isObject(value)) return undefined;
  if (typeof value.branch_intent_id !== "string" || !value.branch_intent_id) return undefined;
  if (!["ready", "blocked", "needs_review"].includes(String(value.status))) return undefined;
  if (typeof value.base_ref !== "string") return undefined;
  if (typeof value.proposed_branch_name !== "string") return undefined;
  return {
    branch_intent_id: value.branch_intent_id,
    status: value.status as "ready" | "blocked" | "needs_review",
    base_ref: value.base_ref,
    proposed_branch_name: value.proposed_branch_name,
    blocked_reason: typeof value.blocked_reason === "string" ? value.blocked_reason : null,
  };
}

function preview(options: {
  branchIntentId: string;
  status: "ready" | "blocked" | "needs_review";
  commandPreview: string;
  checks: BranchDryRunSafetyCheck[];
  blockedReason: string | null;
}): BranchDryRunExecutorJson {
  return {
    execution_preview_id: `branch-dry-run-${sanitizeSegment(options.branchIntentId || "unknown")}`,
    branch_intent_id: options.branchIntentId,
    status: options.status,
    allowed_command_preview: options.commandPreview,
    would_execute: false,
    safety_checks: [...options.checks].sort((left, right) => left.check.localeCompare(right.check)),
    recommended_next_step:
      options.status === "ready"
        ? "operator_execution_review"
        : options.status === "needs_review"
          ? "request_human_review"
          : "stop",
    blocked_reason: options.blockedReason,
  };
}

function check(checkName: string, passed: boolean): BranchDryRunSafetyCheck {
  return {
    check: checkName,
    passed,
    message: passed ? "ok" : `${checkName} failed`,
  };
}

function isProtectedBranch(branch: string): boolean {
  return (
    PROTECTED_EXACT.has(branch) || PROTECTED_PREFIXES.some((prefix) => branch.startsWith(prefix))
  );
}

function quoteShellArg(value: string): string {
  return `"${value.replaceAll(/["\\]/g, "")}"`;
}

function sanitizeBranchName(value: string): string {
  return sanitizeSegment(value);
}

function sanitizeRef(value: string): string {
  return sanitizeSegment(value.replace(/^refs\/heads\//, ""));
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

function sourceIdFrom(value: unknown): string {
  if (isObject(value) && typeof value.branch_intent_id === "string" && value.branch_intent_id)
    return value.branch_intent_id;
  return "unknown";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
