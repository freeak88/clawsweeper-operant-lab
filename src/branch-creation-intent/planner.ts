import type {
  BranchCreationIntentJson,
  BranchCreationPrIntentInput,
  BranchCreationSafetyCheck,
} from "./types.js";

const PROTECTED_EXACT = new Set(["main", "master", "develop"]);
const PROTECTED_PREFIXES = ["release/", "hotfix/"];

export function planBranchCreationIntent(options: {
  prIntent: BranchCreationPrIntentInput | unknown;
  baseRef: string;
  localRefs?: readonly string[] | undefined;
}): BranchCreationIntentJson {
  const source = parsePrIntent(options.prIntent);
  const sourceId = source?.intent_id ?? sourceIdFrom(options.prIntent);
  const rawBranchName = source ? sanitizeRef(source.branch_name || source.intent_id) : "";
  const proposedBranchName = source
    ? sanitizeBranchName(source.branch_name || source.intent_id)
    : "";
  const baseRef = sanitizeRef(options.baseRef);
  const checks: BranchCreationSafetyCheck[] = [
    check("source PR intent is ready", source?.status === "ready"),
    check("base ref is explicit", baseRef.length > 0),
    check("branch name is deterministic and sanitized", proposedBranchName.length > 0),
    check(
      "branch name is not protected",
      !isProtectedBranch(proposedBranchName) && !isProtectedBranch(rawBranchName),
    ),
    check(
      "branch name does not already exist in local refs input",
      !localRefs(options.localRefs).includes(proposedBranchName),
    ),
  ];

  if (statusFrom(options.prIntent) === "needs_review") {
    return intent({
      sourceId,
      status: "needs_review",
      baseRef,
      proposedBranchName,
      checks,
      blockedReason: "source PR creation intent requires human review",
    });
  }

  const failed = checks.find((item) => !item.passed);
  if (!source || failed) {
    return intent({
      sourceId,
      status: "blocked",
      baseRef,
      proposedBranchName,
      checks,
      blockedReason: failed?.message ?? "source PR creation intent is missing or malformed",
    });
  }

  return intent({
    sourceId,
    status: "ready",
    baseRef,
    proposedBranchName,
    checks,
    blockedReason: null,
  });
}

export function renderBranchCreationIntentMarkdown(intent: BranchCreationIntentJson): string {
  return [
    "# Dry-run Branch Creation Intent",
    "",
    "> Intent-only artifact. No branch was created, no checkout occurred, no commit was created, no push occurred, no PR was created, and no GitHub or source state was mutated.",
    "",
    "## Summary",
    "",
    `- Branch intent id: \`${intent.branch_intent_id}\``,
    `- Source PR intent: \`${intent.source_pr_intent || "unknown"}\``,
    `- Status: \`${intent.status}\``,
    `- Base ref: \`${intent.base_ref || "none"}\``,
    `- Proposed branch name: \`${intent.proposed_branch_name || "none"}\``,
    `- Recommended next step: \`${intent.recommended_next_step}\``,
    intent.blocked_reason ? `- Blocked reason: ${intent.blocked_reason}` : "- Blocked reason: none",
    "",
    "## Safety Checks",
    "",
    ...intent.safety_checks.map((item) =>
      [`- ${item.passed ? "PASS" : "FAIL"}: ${item.check}`, `  - ${item.message}`].join("\n"),
    ),
    "",
    "## Rollback Note",
    "",
    intent.rollback_note,
    "",
    "## Safety Boundary",
    "",
    "- No branch was created.",
    "- No checkout occurred.",
    "- No commits were created.",
    "- No push occurred.",
    "- No PR was created.",
    "- No GitHub API calls were made.",
    "- No GitHub or source state was mutated.",
    "- Scheduler/apply/automerge behavior was not changed.",
    "",
  ].join("\n");
}

interface ParsedPrIntent {
  intent_id: string;
  status: "ready" | "blocked" | "needs_review";
  branch_name: string;
}

function parsePrIntent(value: unknown): ParsedPrIntent | undefined {
  if (!isObject(value)) return undefined;
  if (typeof value.intent_id !== "string" || !value.intent_id) return undefined;
  if (!["ready", "blocked", "needs_review"].includes(String(value.status))) return undefined;
  if (typeof value.branch_name !== "string") return undefined;
  if (value.status !== "ready") return undefined;
  return {
    intent_id: value.intent_id,
    status: "ready",
    branch_name: value.branch_name,
  };
}

function intent(options: {
  sourceId: string;
  status: "ready" | "blocked" | "needs_review";
  baseRef: string;
  proposedBranchName: string;
  checks: BranchCreationSafetyCheck[];
  blockedReason: string | null;
}): BranchCreationIntentJson {
  return {
    branch_intent_id: `branch-intent-${sanitizeSegment(options.sourceId || "unknown")}`,
    status: options.status,
    base_ref: options.baseRef,
    proposed_branch_name: options.proposedBranchName,
    source_pr_intent: options.sourceId,
    safety_checks: [...options.checks].sort((left, right) => left.check.localeCompare(right.check)),
    rollback_note:
      "If a future operator-created branch is not needed, delete that branch manually; this dry-run intent created no branch to roll back.",
    recommended_next_step:
      options.status === "ready"
        ? "manual_branch_creation_review"
        : options.status === "needs_review"
          ? "request_human_review"
          : "stop",
    blocked_reason: options.blockedReason,
  };
}

function check(checkName: string, passed: boolean): BranchCreationSafetyCheck {
  return {
    check: checkName,
    passed,
    message: passed ? "ok" : `${checkName} failed`,
  };
}

function localRefs(value: readonly string[] | undefined): string[] {
  return [...new Set((value ?? []).map((ref) => sanitizeRef(ref)).filter(Boolean))].sort();
}

function isProtectedBranch(branch: string): boolean {
  return (
    PROTECTED_EXACT.has(branch) || PROTECTED_PREFIXES.some((prefix) => branch.startsWith(prefix))
  );
}

function sanitizeBranchName(value: string): string {
  const sanitized = sanitizeSegment(value);
  if (sanitized.startsWith("operator/")) return sanitized;
  return `operator/${sanitized || "branch-intent"}`;
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
  if (isObject(value) && typeof value.intent_id === "string" && value.intent_id)
    return value.intent_id;
  return "unknown";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
