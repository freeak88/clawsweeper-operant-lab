import { execFileSync } from "node:child_process";
import { isAbsolute, relative, resolve } from "node:path";

import type {
  LocalValidationCommandResult,
  LocalValidationCommandRunner,
  LocalValidationResultJson,
  LocalValidationRunnerOptions,
} from "./types.js";

const DENIED_COMMAND_PATTERNS = [
  /\bgit\b/i,
  /\bgh\b/i,
  /\bcurl\b/i,
  /\bwget\b/i,
  /\brm\s+-rf\b/i,
  /\bpowershell\b/i,
  /\bssh\b/i,
  /\bscp\b/i,
  /\bnpm\s+publish\b/i,
];

export function runLocalValidation(
  options: LocalValidationRunnerOptions,
): LocalValidationResultJson {
  const application = parseApplication(options.application);
  const patch = parsePatch(options.patch);
  const patchId = patch?.patch_id ?? sourcePatchId(options.patch);
  const workspaceRoot = application?.isolated_workspace
    ? resolve(application.isolated_workspace)
    : "";
  const mainRepoRoot = resolve(options.mainRepoRoot ?? process.cwd());
  const commands = patch ? normalizeCommands(patch.tests_to_run) : [];

  if (application?.status === "needs_review") {
    return result({
      patchId,
      status: "needs_review",
      workspaceRoot,
      commands,
      results: [],
      blockedReason: "isolated patch application requires human review",
    });
  }

  const staticFailure = !application
    ? "isolated patch application is missing or malformed"
    : application.status !== "applied_isolated"
      ? "isolated patch application status is not applied_isolated"
      : !patch
        ? "patch proposal is missing or malformed"
        : patch.status !== "patch_proposed"
          ? "patch proposal status is not patch_proposed"
          : !workspaceRoot
            ? "isolated workspace is missing"
            : isSameOrInside(workspaceRoot, mainRepoRoot)
              ? "isolated workspace is inside the main repository"
              : commands.length === 0
                ? "no validation commands are present"
                : firstDisallowedCommand(commands);

  if (staticFailure) {
    return result({
      patchId,
      status: "blocked",
      workspaceRoot,
      commands,
      results: [],
      blockedReason: staticFailure,
    });
  }

  if (options.execute !== true) {
    return result({
      patchId,
      status: "dry_run",
      workspaceRoot,
      commands,
      results: [],
      blockedReason: null,
    });
  }

  const runner = options.runner ?? createDefaultLocalValidationCommandRunner();
  const results = commands.map((command) => runner.run(command, workspaceRoot));
  const failed = results.find((item) => item.status === "failed" || item.exit_code !== 0);
  return result({
    patchId,
    status: failed ? "failed" : "passed",
    workspaceRoot,
    commands,
    results,
    blockedReason: failed ? `validation command failed: ${failed.command}` : null,
    didExecute: true,
  });
}

export function renderLocalValidationMarkdown(value: LocalValidationResultJson): string {
  return [
    "# Local Validation Runner",
    "",
    "> Local validation runs only against an isolated workspace. Default mode is dry-run. Execution requires explicit `--execute` and commands must pass the allowlist and denylist gates.",
    "",
    "## Summary",
    "",
    `- Validation run id: \`${value.validation_run_id}\``,
    `- Patch id: \`${value.patch_id || "unknown"}\``,
    `- Status: \`${value.status}\``,
    `- Workspace root: \`${value.workspace_root || "none"}\``,
    `- Did execute: \`${String(value.did_execute)}\``,
    `- Recommended next step: \`${value.recommended_next_step}\``,
    value.blocked_reason ? `- Blocked reason: ${value.blocked_reason}` : "- Blocked reason: none",
    "",
    "## Commands",
    "",
    ...listOrNone(value.commands),
    "",
    "## Results",
    "",
    ...resultsMarkdown(value.results),
    "",
    "## Safety Boundary",
    "",
    "- Default mode does not run validation commands.",
    "- Execution requires explicit `--execute`.",
    "- Commands run only against the isolated workspace.",
    "- The main working tree is not validated or modified.",
    "- No commits are created.",
    "- No push occurs.",
    "- No PR is created.",
    "- No GitHub API calls are made.",
    "- Scheduler, apply, and automerge behavior are not changed.",
    "",
  ].join("\n");
}

export function createDefaultLocalValidationCommandRunner(): LocalValidationCommandRunner {
  return {
    run: (command, workspaceRoot) => {
      const [program, ...args] = splitCommand(command);
      if (!program) {
        return { command, exit_code: 1, status: "failed", output: "empty command" };
      }
      try {
        const output = execFileSync(program, args, {
          cwd: workspaceRoot,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        });
        return { command, exit_code: 0, status: "passed", output: trimOutput(output) };
      } catch (error) {
        const output = isObject(error) && typeof error.stderr === "string" ? error.stderr : "";
        return {
          command,
          exit_code: exitCodeFrom(error),
          status: "failed",
          output: trimOutput(output),
        };
      }
    },
  };
}

function result(options: {
  patchId: string;
  status: "dry_run" | "passed" | "failed" | "blocked" | "needs_review";
  workspaceRoot: string;
  commands: string[];
  results: LocalValidationCommandResult[];
  blockedReason: string | null;
  didExecute?: boolean | undefined;
}): LocalValidationResultJson {
  return {
    validation_run_id: `local-validation-${sanitizeSegment(options.patchId || "unknown")}`,
    patch_id: options.patchId,
    status: options.status,
    workspace_root: options.workspaceRoot,
    did_execute: options.didExecute === true,
    commands: [...options.commands],
    results: [...options.results].sort((left, right) => left.command.localeCompare(right.command)),
    recommended_next_step:
      options.status === "passed"
        ? "prepare_commit_intent"
        : options.status === "needs_review"
          ? "request_human_review"
          : "stop",
    blocked_reason: options.blockedReason,
  };
}

function parseApplication(
  value: unknown,
): { patch_id: string; status: string; isolated_workspace: string } | undefined {
  if (!isObject(value)) return undefined;
  if (typeof value.patch_id !== "string") return undefined;
  if (typeof value.status !== "string") return undefined;
  if (!["dry_run", "applied_isolated", "blocked", "needs_review"].includes(value.status))
    return undefined;
  if (typeof value.isolated_workspace !== "string") return undefined;
  return {
    patch_id: value.patch_id,
    status: value.status,
    isolated_workspace: value.isolated_workspace,
  };
}

function parsePatch(
  value: unknown,
): { patch_id: string; status: string; tests_to_run: string[] } | undefined {
  if (!isObject(value)) return undefined;
  if (typeof value.patch_id !== "string" || !value.patch_id) return undefined;
  if (typeof value.status !== "string") return undefined;
  if (!["patch_proposed", "blocked"].includes(value.status)) return undefined;
  return {
    patch_id: value.patch_id,
    status: value.status,
    tests_to_run: stringArray(value.tests_to_run),
  };
}

function firstDisallowedCommand(commands: readonly string[]): string | null {
  for (const command of commands) {
    const denied = DENIED_COMMAND_PATTERNS.find((pattern) => pattern.test(command));
    if (denied) return `validation command is denied: ${command}`;
    if (!isAllowlistedCommand(command)) return `validation command is not allowlisted: ${command}`;
  }
  return null;
}

function isAllowlistedCommand(command: string): boolean {
  return (
    command === "pnpm run build" ||
    command === "pnpm test" ||
    command === "node --test" ||
    command.startsWith("node --test ") ||
    command === "pnpm exec oxlint" ||
    command.startsWith("pnpm exec oxlint ") ||
    command === "pnpm exec oxfmt --check" ||
    command.startsWith("pnpm exec oxfmt --check ")
  );
}

function normalizeCommands(commands: readonly string[]): string[] {
  return commands.map((command) => command.trim()).filter(Boolean);
}

function isSameOrInside(candidate: string, parent: string): boolean {
  const relativePath = relative(parent, candidate);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function splitCommand(command: string): string[] {
  return command.split(/\s+/).filter(Boolean);
}

function exitCodeFrom(error: unknown): number {
  if (isObject(error) && typeof error.status === "number") return error.status;
  return 1;
}

function trimOutput(value: string): string {
  return value.trim().slice(0, 4000);
}

function listOrNone(items: readonly string[]): string[] {
  return items.length ? items.map((item) => `- \`${item}\``) : ["- none"];
}

function resultsMarkdown(results: readonly LocalValidationCommandResult[]): string[] {
  if (results.length === 0) return ["- none"];
  return results.map((item) => `- \`${item.command}\`: ${item.status} (${item.exit_code})`);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function sourcePatchId(value: unknown): string {
  if (isObject(value) && typeof value.patch_id === "string" && value.patch_id)
    return value.patch_id;
  return "unknown";
}

function sanitizeSegment(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9/-]+/g, "-")
    .replaceAll(/\/+/g, "/")
    .replaceAll(/-+/g, "-")
    .replace(/^[-/]+|[-/]+$/g, "");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
