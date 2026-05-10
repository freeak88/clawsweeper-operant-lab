import { execFileSync } from "node:child_process";

import type {
  BranchGuardedExecutionJson,
  BranchGuardedExecutorOptions,
  BranchGuardedGitRunner,
  BranchGuardedSafetyCheck,
} from "./types.js";

const PROTECTED_EXACT = new Set(["main", "master", "develop"]);
const PROTECTED_PREFIXES = ["release/", "hotfix/"];

export function executeBranchGuarded(
  options: BranchGuardedExecutorOptions,
): BranchGuardedExecutionJson {
  const intent = parseBranchIntent(options.branchIntent);
  const preview = parsePreview(options.preview);
  const branchIntentId = intent?.branch_intent_id ?? sourceIdFrom(options.branchIntent);
  const branchName = intent ? sanitizeBranchName(intent.proposed_branch_name) : "";
  const baseRef = intent ? sanitizeRef(intent.base_ref) : "";
  const command = branchName && baseRef ? expectedCommand(branchName, baseRef) : "";
  const execute = options.execute === true;
  const staticChecks: BranchGuardedSafetyCheck[] = [
    check("branch intent is ready", intent?.status === "ready"),
    check("dry-run preview is ready", preview?.status === "ready"),
    check("dry-run preview would_execute is false", preview?.would_execute === false),
    check("branch name is explicit and sanitized", branchName.length > 0),
    check("base ref is explicit and sanitized", baseRef.length > 0),
    check("branch name is not protected", !isProtectedBranch(branchName)),
    check("preview command matches deterministic expected command", preview?.command === command),
    check(
      "push, commit, PR, and GitHub commands are not generated",
      commandIsLocalBranchOnly(command),
    ),
  ];

  if (intent?.status === "needs_review" || preview?.status === "needs_review") {
    return result({
      branchIntentId,
      status: "needs_review",
      command,
      checks: staticChecks,
      blockedReason: "source branch creation flow requires human review",
    });
  }

  const staticFailure = staticChecks.find((item) => !item.passed);
  if (
    !intent ||
    !preview ||
    intent.status === "blocked" ||
    preview.status === "blocked" ||
    staticFailure
  ) {
    return result({
      branchIntentId,
      status: "blocked",
      command,
      checks: staticChecks,
      blockedReason:
        intent?.blocked_reason ??
        preview?.blocked_reason ??
        staticFailure?.message ??
        "branch guarded execution inputs are missing or malformed",
    });
  }

  if (!execute) {
    return result({
      branchIntentId,
      status: "dry_run",
      command,
      checks: staticChecks,
      blockedReason: null,
    });
  }

  const runner = options.gitRunner ?? createDefaultGitRunner();
  const dynamicChecks = collectDynamicChecks(runner, branchName, baseRef);
  const checks = [...staticChecks, ...dynamicChecks];
  const dynamicFailure = dynamicChecks.find((item) => !item.passed);
  if (dynamicFailure) {
    return result({
      branchIntentId,
      status: "blocked",
      command,
      checks,
      blockedReason: dynamicFailure.message,
    });
  }

  try {
    runner.createBranch(branchName, baseRef);
  } catch (error) {
    return result({
      branchIntentId,
      status: "blocked",
      command,
      checks: [...checks, check("local branch creation command completed", false)],
      blockedReason: error instanceof Error ? error.message : "local branch creation failed",
      attemptedExecution: true,
    });
  }

  return result({
    branchIntentId,
    status: "executed",
    command,
    checks: [...checks, check("local branch creation command completed", true)],
    blockedReason: null,
    attemptedExecution: true,
    didExecute: true,
  });
}

export function renderBranchGuardedExecutionMarkdown(
  execution: BranchGuardedExecutionJson,
): string {
  return [
    "# Guarded Local Branch Creation",
    "",
    "> Local branch creation is guarded. Default mode is dry-run. Execution requires explicit `--execute`, clean local Git state, matching approved preview command, and ready inputs.",
    "",
    "## Summary",
    "",
    `- Execution id: \`${execution.execution_id}\``,
    `- Branch intent id: \`${execution.branch_intent_id || "unknown"}\``,
    `- Status: \`${execution.status}\``,
    `- Would execute: \`${String(execution.would_execute)}\``,
    `- Did execute: \`${String(execution.did_execute)}\``,
    `- Command: \`${execution.command || "none"}\``,
    `- Recommended next step: \`${execution.recommended_next_step}\``,
    execution.blocked_reason
      ? `- Blocked reason: ${execution.blocked_reason}`
      : "- Blocked reason: none",
    "",
    "## Safety Checks",
    "",
    ...execution.safety_checks.map((item) =>
      [`- ${item.passed ? "PASS" : "FAIL"}: ${item.check}`, `  - ${item.message}`].join("\n"),
    ),
    "",
    "## Rollback Instruction",
    "",
    execution.rollback_instruction,
    "",
    "## Safety Boundary",
    "",
    "- Default mode does not execute Git.",
    "- Execution requires explicit `--execute`.",
    "- No push occurs.",
    "- No commits are created.",
    "- No PR is created.",
    "- No GitHub API calls are made.",
    "- No scheduler, apply, or automerge behavior is changed.",
    "",
  ].join("\n");
}

export function createDefaultGitRunner(): BranchGuardedGitRunner {
  return {
    isWorkingTreeClean: () => git(["status", "--porcelain"]).trim().length === 0,
    currentBranch: () => git(["rev-parse", "--abbrev-ref", "HEAD"]).trim(),
    branchExists: (branchName) =>
      gitSucceeds(["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`]),
    refExists: (refName) =>
      gitSucceeds(["rev-parse", "--verify", "--quiet", `${refName}^{commit}`]),
    createBranch: (branchName, baseRef) => {
      git(["checkout", "-b", branchName, baseRef]);
    },
  };
}

interface ParsedIntent {
  branch_intent_id: string;
  status: "ready" | "blocked" | "needs_review";
  base_ref: string;
  proposed_branch_name: string;
  blocked_reason: string | null;
}

interface ParsedPreview {
  status: "ready" | "blocked" | "needs_review";
  command: string;
  would_execute: boolean;
  blocked_reason: string | null;
}

function collectDynamicChecks(
  runner: BranchGuardedGitRunner,
  branchName: string,
  baseRef: string,
): BranchGuardedSafetyCheck[] {
  const clean = runner.isWorkingTreeClean();
  const currentBranch = sanitizeRef(runner.currentBranch());
  const branchExists = runner.branchExists(branchName);
  const baseExists = runner.refExists(baseRef);
  return [
    check("working tree is clean", clean),
    check("current branch is not proposed branch", currentBranch !== branchName),
    check("target branch does not already exist locally", !branchExists),
    check("base ref exists locally", baseExists),
  ];
}

function result(options: {
  branchIntentId: string;
  status: "dry_run" | "executed" | "blocked" | "needs_review";
  command: string;
  checks: BranchGuardedSafetyCheck[];
  blockedReason: string | null;
  attemptedExecution?: boolean | undefined;
  didExecute?: boolean | undefined;
}): BranchGuardedExecutionJson {
  const branch = branchFromCommand(options.command);
  const base = baseFromCommand(options.command) || "main";
  return {
    execution_id: `branch-guarded-${sanitizeSegment(options.branchIntentId || "unknown")}`,
    branch_intent_id: options.branchIntentId,
    status: options.status,
    would_execute: options.attemptedExecution === true,
    did_execute: options.didExecute === true,
    command: options.command,
    safety_checks: [...options.checks].sort((left, right) => left.check.localeCompare(right.check)),
    rollback_instruction: branch
      ? `git checkout ${quoteShellArg(base)} && git branch -D ${quoteShellArg(branch)}`
      : "No branch was created; no rollback is required.",
    recommended_next_step:
      options.status === "executed"
        ? "run_local_validation"
        : options.status === "needs_review"
          ? "request_human_review"
          : "stop",
    blocked_reason: options.blockedReason,
  };
}

function parseBranchIntent(value: unknown): ParsedIntent | undefined {
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

function parsePreview(value: unknown): ParsedPreview | undefined {
  if (!isObject(value)) return undefined;
  if (!["ready", "blocked", "needs_review"].includes(String(value.status))) return undefined;
  if (typeof value.allowed_command_preview !== "string") return undefined;
  if (typeof value.would_execute !== "boolean") return undefined;
  return {
    status: value.status as "ready" | "blocked" | "needs_review",
    command: value.allowed_command_preview,
    would_execute: value.would_execute,
    blocked_reason: typeof value.blocked_reason === "string" ? value.blocked_reason : null,
  };
}

function expectedCommand(branchName: string, baseRef: string): string {
  return `git checkout -b ${quoteShellArg(branchName)} ${quoteShellArg(baseRef)}`;
}

function commandIsLocalBranchOnly(command: string): boolean {
  return (
    /^git checkout -b "[a-z0-9/-]+" "[a-z0-9/-]+"$/.test(command) &&
    !/\b(push|commit|merge|gh|pr|api)\b/.test(command)
  );
}

function branchFromCommand(command: string): string {
  return /^git checkout -b "([^"]+)" "[^"]+"$/.exec(command)?.[1] ?? "";
}

function baseFromCommand(command: string): string {
  return /^git checkout -b "[^"]+" "([^"]+)"$/.exec(command)?.[1] ?? "";
}

function check(checkName: string, passed: boolean): BranchGuardedSafetyCheck {
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

function sourceIdFrom(value: unknown): string {
  if (isObject(value) && typeof value.branch_intent_id === "string" && value.branch_intent_id)
    return value.branch_intent_id;
  return "unknown";
}

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" });
}

function gitSucceeds(args: string[]): boolean {
  try {
    git(args);
    return true;
  } catch {
    return false;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
