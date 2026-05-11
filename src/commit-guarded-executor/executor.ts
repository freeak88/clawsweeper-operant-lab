import { execFileSync } from "node:child_process";

import type {
  CommitGuardedExecutionJson,
  CommitGuardedExecutorOptions,
  CommitGuardedGitRunner,
  CommitGuardedSafetyCheck,
} from "./types.js";

const CONVENTIONAL_COMMIT_RE =
  /^(feat|fix|docs|test|refactor|chore|build|ci|perf|style|revert)(\([a-z0-9-]+\))?!?: [a-z0-9].+/;
const FORBIDDEN_COMMAND_RE =
  /\b(push|gh|curl|wget|ssh|scp)\b|pull request|pr create|&&|\|\||;|`|\$\(|>|<|\brm\s+-rf\b|npm publish/i;

export function executeCommitGuarded(
  options: CommitGuardedExecutorOptions,
): CommitGuardedExecutionJson {
  const intent = parseCommitIntent(options.commitIntent);
  const preview = parsePreview(options.preview);
  const commitIntentId = intent?.commit_intent_id ?? sourceIdFrom(options.commitIntent);
  const files = intent
    ? sortedUnique(intent.files_expected.map(sanitizeFilePath).filter(Boolean))
    : [];
  const message = intent ? sanitizeCommitMessage(intent.proposed_commit_message) : "";
  const commands = expectedCommands(files, message);
  const execute = options.execute === true;
  const staticChecks: CommitGuardedSafetyCheck[] = [
    check("commit intent is ready", intent?.status === "ready"),
    check("dry-run preview is ready", preview?.status === "ready"),
    check("dry-run preview would_execute is false", preview?.would_execute === false),
    check("expected files are present", files.length > 0),
    check("commit message is conventional", isConventionalCommit(message)),
    check("commit message matches intent", intent?.proposed_commit_message === message),
    check(
      "preview commands match deterministic expected commands",
      arraysEqual(preview?.commands ?? [], commands),
    ),
    check("commands are local commit only", commands.every(isAllowedExecutionCommand)),
  ];

  if (intent?.status === "needs_review" || preview?.status === "needs_review") {
    return result({
      commitIntentId,
      status: "needs_review",
      commands,
      blockedReason: "source commit flow requires human review",
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
      commitIntentId,
      status: "blocked",
      commands,
      blockedReason:
        intent?.blocked_reason ??
        preview?.blocked_reason ??
        staticFailure?.message ??
        "commit guarded execution inputs are missing or malformed",
    });
  }

  if (!execute) {
    return result({
      commitIntentId,
      status: "dry_run",
      commands,
      blockedReason: null,
    });
  }

  const runner = options.gitRunner ?? createDefaultGitRunner();
  const dynamicChecks = collectDynamicChecks(runner, files);
  const dynamicFailure = dynamicChecks.find((item) => !item.passed);
  if (dynamicFailure) {
    return result({
      commitIntentId,
      status: "blocked",
      commands,
      blockedReason: dynamicFailure.message,
    });
  }

  try {
    runner.stageFiles(files);
    runner.commit(message);
    const commitHash = sanitizeCommitHash(runner.revParseHead());
    return result({
      commitIntentId,
      status: "committed",
      commands,
      blockedReason: null,
      attemptedExecution: true,
      didExecute: true,
      commitHash,
    });
  } catch (error) {
    return result({
      commitIntentId,
      status: "blocked",
      commands,
      blockedReason: error instanceof Error ? error.message : "local commit execution failed",
      attemptedExecution: true,
    });
  }
}

export function renderCommitGuardedExecutionMarkdown(
  execution: CommitGuardedExecutionJson,
): string {
  return [
    "# Guarded Local Commit Execution",
    "",
    "> Local commit execution is guarded. Default mode is dry-run. Execution requires explicit `--execute`, ready inputs, matching approved preview commands, and a changed-file set limited to expected files.",
    "",
    "## Summary",
    "",
    `- Execution id: \`${execution.execution_id}\``,
    `- Commit intent id: \`${execution.commit_intent_id || "unknown"}\``,
    `- Status: \`${execution.status}\``,
    `- Would execute: \`${String(execution.would_execute)}\``,
    `- Did execute: \`${String(execution.did_execute)}\``,
    `- Commit hash: \`${execution.commit_hash ?? "none"}\``,
    `- Recommended next step: \`${execution.recommended_next_step}\``,
    execution.blocked_reason
      ? `- Blocked reason: ${execution.blocked_reason}`
      : "- Blocked reason: none",
    "",
    "## Commands",
    "",
    ...listOrNone(execution.commands),
    "",
    "## Rollback Instruction",
    "",
    execution.rollback_instruction,
    "",
    "## Safety Boundary",
    "",
    "- Default mode does not stage or commit.",
    "- Execution requires explicit `--execute`.",
    "- No push occurs.",
    "- No PR is created.",
    "- No GitHub API calls are made.",
    "- No scheduler, apply, or automerge behavior is changed.",
    "",
  ].join("\n");
}

export function createDefaultGitRunner(): CommitGuardedGitRunner {
  return {
    changedFiles: () => parseChangedFiles(git(["status", "--porcelain"])),
    stageFiles: (files) => {
      git(["add", "--", ...files]);
    },
    commit: (message) => {
      git(["commit", "-m", message]);
    },
    revParseHead: () => git(["rev-parse", "HEAD"]).trim(),
  };
}

interface ParsedIntent {
  commit_intent_id: string;
  status: "ready" | "blocked" | "needs_review";
  proposed_commit_message: string;
  files_expected: string[];
  blocked_reason: string | null;
}

interface ParsedPreview {
  status: "ready" | "blocked" | "needs_review";
  commands: string[];
  would_execute: boolean;
  blocked_reason: string | null;
}

function collectDynamicChecks(
  runner: CommitGuardedGitRunner,
  expectedFiles: string[],
): CommitGuardedSafetyCheck[] {
  const changedFiles = sortedUnique(runner.changedFiles().map(sanitizeFilePath).filter(Boolean));
  const unexpected = changedFiles.filter((file) => !expectedFiles.includes(file));
  const missing = expectedFiles.filter((file) => !changedFiles.includes(file));
  return [
    check("working tree contains changed files", changedFiles.length > 0),
    check("working tree contains only expected files changed", unexpected.length === 0),
    check("all expected files are changed", missing.length === 0),
  ];
}

function result(options: {
  commitIntentId: string;
  status: "dry_run" | "committed" | "blocked" | "needs_review";
  commands: string[];
  blockedReason: string | null;
  attemptedExecution?: boolean | undefined;
  didExecute?: boolean | undefined;
  commitHash?: string | undefined;
}): CommitGuardedExecutionJson {
  return {
    execution_id: `commit-guarded-${sanitizeSegment(options.commitIntentId || "unknown")}`,
    commit_intent_id: options.commitIntentId,
    status: options.status,
    would_execute: options.attemptedExecution === true,
    did_execute: options.didExecute === true,
    commands: [...options.commands],
    commit_hash: options.commitHash ?? null,
    rollback_instruction:
      options.status === "committed"
        ? "git reset --soft HEAD~1"
        : "No commit was created; no rollback is required.",
    recommended_next_step:
      options.status === "committed"
        ? "prepare_pr_creation"
        : options.status === "needs_review"
          ? "request_human_review"
          : "stop",
    blocked_reason: options.blockedReason,
  };
}

function parseCommitIntent(value: unknown): ParsedIntent | undefined {
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

function parsePreview(value: unknown): ParsedPreview | undefined {
  if (!isObject(value)) return undefined;
  if (!["ready", "blocked", "needs_review"].includes(String(value.status))) return undefined;
  if (!Array.isArray(value.allowed_commands_preview)) return undefined;
  if (typeof value.would_execute !== "boolean") return undefined;
  return {
    status: value.status as "ready" | "blocked" | "needs_review",
    commands: value.allowed_commands_preview.filter(
      (item): item is string => typeof item === "string",
    ),
    would_execute: value.would_execute,
    blocked_reason: typeof value.blocked_reason === "string" ? value.blocked_reason : null,
  };
}

function expectedCommands(files: string[], message: string): string[] {
  if (files.length === 0 || !message) return [];
  return [
    `git add ${files.map(quoteShellArg).join(" ")}`,
    `git commit -m ${quoteShellArg(message)}`,
  ];
}

function isAllowedExecutionCommand(command: string): boolean {
  if (FORBIDDEN_COMMAND_RE.test(command)) return false;
  return command.startsWith("git add ") || command.startsWith("git commit -m ");
}

function isConventionalCommit(message: string): boolean {
  return CONVENTIONAL_COMMIT_RE.test(message);
}

function parseChangedFiles(statusOutput: string): string[] {
  return statusOutput
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const path = line.slice(3);
      const renamePath = path.includes(" -> ") ? path.split(" -> ").at(-1) : path;
      return sanitizeFilePath(renamePath ?? "");
    })
    .filter(Boolean)
    .sort();
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

function sanitizeCommitHash(value: string): string {
  return value.replaceAll(/[^a-fA-F0-9]/g, "").toLowerCase();
}

function sanitizeSegment(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9/-]+/g, "-")
    .replaceAll(/\/+/g, "/")
    .replaceAll(/-+/g, "-")
    .replace(/^[-/]+|[-/]+$/g, "");
}

function check(checkName: string, passed: boolean): CommitGuardedSafetyCheck {
  return {
    check: checkName,
    passed,
    message: passed ? "ok" : `${checkName} failed`,
  };
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function sourceIdFrom(value: unknown): string {
  if (isObject(value) && typeof value.commit_intent_id === "string" && value.commit_intent_id)
    return value.commit_intent_id;
  return "unknown";
}

function listOrNone(values: string[]): string[] {
  return values.length > 0 ? values.map((value) => `- \`${value}\``) : ["- none"];
}

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
