import type {
  CommitDryRunExecutorJson,
  CommitDryRunIntentInput,
  CommitDryRunSafetyCheck,
  CommitDryRunExecutorStatus,
} from "./types.js";

const CONVENTIONAL_COMMIT_RE =
  /^(feat|fix|docs|test|refactor|chore|build|ci|perf|style|revert)(\([a-z0-9-]+\))?!?: [a-z0-9].+/;
const FORBIDDEN_COMMAND_RE =
  /\b(push|gh|curl|wget|ssh|scp)\b|pull request|pr create|&&|\|\||;|`|\$\(|>|<|\brm\s+-rf\b|npm publish/i;

export function planCommitDryRunExecution(options: {
  commitIntent: CommitDryRunIntentInput | unknown;
}): CommitDryRunExecutorJson {
  const source = parseCommitIntent(options.commitIntent);
  const commitIntentId = source?.commit_intent_id ?? sourceIdFrom(options.commitIntent);
  const status = statusFrom(options.commitIntent);
  const files = source ? source.files_expected.map(sanitizeFilePath).filter(Boolean).sort() : [];
  const message = source ? sanitizeCommitMessage(source.proposed_commit_message) : "";
  const commands =
    files.length > 0 && message
      ? [`git add ${files.map(quoteShellArg).join(" ")}`, `git commit -m ${quoteShellArg(message)}`]
      : [];
  const checks: CommitDryRunSafetyCheck[] = [
    check("source commit intent is ready", source?.status === "ready"),
    check("expected files are present", files.length > 0),
    check("commit message is present", message.length > 0),
    check("commit message is conventional", isConventionalCommit(message)),
    check("commands are deterministic", commands.length === 2),
    check(
      "commands are limited to add and commit preview",
      commands.every(isAllowedPreviewCommand),
    ),
    check("executor is dry-run only", true),
  ];

  if (status === "needs_review") {
    return preview({
      commitIntentId,
      status: "needs_review",
      commands,
      checks,
      blockedReason: "source commit intent requires human review",
    });
  }

  const failed = checks.find((item) => !item.passed);
  if (!source || source.status === "blocked" || failed) {
    return preview({
      commitIntentId,
      status: "blocked",
      commands,
      checks,
      blockedReason:
        source?.blocked_reason ?? failed?.message ?? "source commit intent is missing or malformed",
    });
  }

  return preview({
    commitIntentId,
    status: "ready",
    commands,
    checks,
    blockedReason: null,
  });
}

export function renderCommitDryRunExecutorMarkdown(preview: CommitDryRunExecutorJson): string {
  return [
    "# Guarded Commit Dry-run Executor",
    "",
    "> Dry-run command preview only. No files were staged, no commit was created, no push occurred, no PR was created, no GitHub API call was made, and no source files were mutated.",
    "",
    "## Summary",
    "",
    `- Execution preview id: \`${preview.execution_preview_id}\``,
    `- Commit intent id: \`${preview.commit_intent_id || "unknown"}\``,
    `- Status: \`${preview.status}\``,
    `- Would execute: \`${String(preview.would_execute)}\``,
    `- Recommended next step: \`${preview.recommended_next_step}\``,
    preview.blocked_reason
      ? `- Blocked reason: ${preview.blocked_reason}`
      : "- Blocked reason: none",
    "",
    "## Allowed Command Preview",
    "",
    ...listOrNone(preview.allowed_commands_preview),
    "",
    "## Safety Checks",
    "",
    ...preview.safety_checks.map((item) =>
      [`- ${item.passed ? "PASS" : "FAIL"}: ${item.check}`, `  - ${item.message}`].join("\n"),
    ),
    "",
    "## Safety Boundary",
    "",
    "- No files were staged.",
    "- No commit was created.",
    "- No push occurred.",
    "- No PR was created.",
    "- No GitHub API calls were made.",
    "- No source files were mutated.",
    "- Scheduler, apply, and automerge behavior were not changed.",
    "",
  ].join("\n");
}

interface ParsedCommitIntent {
  commit_intent_id: string;
  status: "ready" | "blocked" | "needs_review";
  proposed_commit_message: string;
  files_expected: string[];
  blocked_reason: string | null;
}

function parseCommitIntent(value: unknown): ParsedCommitIntent | undefined {
  if (!isObject(value)) return undefined;
  if (typeof value.commit_intent_id !== "string" || !value.commit_intent_id) return undefined;
  if (!["ready", "blocked", "needs_review"].includes(String(value.status))) return undefined;
  if (typeof value.proposed_commit_message !== "string") return undefined;
  if (!Array.isArray(value.files_expected)) return undefined;
  return {
    commit_intent_id: value.commit_intent_id,
    status: value.status as "ready" | "blocked" | "needs_review",
    proposed_commit_message: value.proposed_commit_message,
    files_expected: value.files_expected.filter((item): item is string => typeof item === "string"),
    blocked_reason: typeof value.blocked_reason === "string" ? value.blocked_reason : null,
  };
}

function preview(options: {
  commitIntentId: string;
  status: CommitDryRunExecutorStatus;
  commands: string[];
  checks: CommitDryRunSafetyCheck[];
  blockedReason: string | null;
}): CommitDryRunExecutorJson {
  return {
    execution_preview_id: `commit-dry-run-${sanitizeSegment(options.commitIntentId || "unknown")}`,
    commit_intent_id: options.commitIntentId,
    status: options.status,
    allowed_commands_preview: [...options.commands].sort(),
    would_execute: false,
    safety_checks: [...options.checks].sort((left, right) => left.check.localeCompare(right.check)),
    recommended_next_step:
      options.status === "ready"
        ? "operator_commit_execution_review"
        : options.status === "needs_review"
          ? "request_human_review"
          : "stop",
    blocked_reason: options.blockedReason,
  };
}

function check(checkName: string, passed: boolean): CommitDryRunSafetyCheck {
  return {
    check: checkName,
    passed,
    message: passed ? "ok" : `${checkName} failed`,
  };
}

function isAllowedPreviewCommand(command: string): boolean {
  if (FORBIDDEN_COMMAND_RE.test(command)) return false;
  return command.startsWith("git add ") || command.startsWith("git commit -m ");
}

function isConventionalCommit(message: string): boolean {
  return CONVENTIONAL_COMMIT_RE.test(message);
}

function quoteShellArg(value: string): string {
  return `"${value.replaceAll(/["\\]/g, "")}"`;
}

function sanitizeCommitMessage(value: string): string {
  return value
    .replaceAll(/[\r\n\t]+/g, " ")
    .replaceAll(/["\\`$<>|;&]/g, "")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function sanitizeFilePath(value: string): string {
  return value
    .replaceAll(/\\/g, "/")
    .replaceAll(/["`$<>|;&]/g, "")
    .replaceAll(/\.\.+/g, ".")
    .replace(/^\/+/, "")
    .trim();
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
  if (isObject(value) && typeof value.commit_intent_id === "string" && value.commit_intent_id)
    return value.commit_intent_id;
  return "unknown";
}

function listOrNone(values: string[]): string[] {
  return values.length > 0 ? values.map((value) => `- \`${value}\``) : ["- none"];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
