import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import { sortStable } from "../stable-json.js";
import type { PatchProposalJson } from "../patch-generation/types.js";
import type {
  IsolatedPatchApplicationJson,
  IsolatedPatchApplicationOptions,
  IsolatedPatchRunner,
} from "./types.js";

export function applyPatchIsolated(
  options: IsolatedPatchApplicationOptions,
): IsolatedPatchApplicationJson {
  const patch = parsePatch(options.patch);
  const validation = parseValidation(options.validation);
  const branchExecution = parseBranchExecution(options.branchExecution);
  const patchId = patch?.patch_id ?? sourcePatchId(options.patch);
  const outputRoot = resolve(options.outputRoot ?? "results/isolated-patch-application");
  const workspaceRoot = options.workspaceRoot ? resolve(options.workspaceRoot) : "";
  const mainRepoRoot = resolve(options.mainRepoRoot ?? process.cwd());
  const isolatedWorkspace = patch
    ? join(outputRoot, "isolated-workspaces", sanitizeSegment(patch.patch_id))
    : "";
  const simulatedFiles = patch ? filesFromPatch(patch) : [];

  if (validation?.status === "needs_review") {
    return application({
      patchId,
      status: "needs_review",
      workspaceRoot,
      isolatedWorkspace,
      simulatedFiles,
      blockedReason: "patch validation requires human review",
    });
  }

  const staticFailure = !patch
    ? "patch proposal is missing or malformed"
    : patch.status !== "patch_proposed"
      ? "patch proposal status is not patch_proposed"
      : !validation
        ? "patch validation is missing or malformed"
        : validation.status !== "valid"
          ? "patch validation status is not valid"
          : !branchExecution
            ? "branch guarded execution is missing or malformed"
            : branchExecution.status !== "executed"
              ? "branch guarded execution status is not executed"
              : null;

  if (staticFailure) {
    return application({
      patchId,
      status: "blocked",
      workspaceRoot,
      isolatedWorkspace,
      simulatedFiles,
      blockedReason: staticFailure,
    });
  }

  if (options.execute !== true) {
    return application({
      patchId,
      status: "dry_run",
      workspaceRoot,
      isolatedWorkspace,
      simulatedFiles,
      blockedReason: null,
    });
  }

  const isolationFailure = !workspaceRoot
    ? "workspace root is required for isolated execution"
    : isSameOrInside(isolatedWorkspace, mainRepoRoot)
      ? "isolated workspace path is inside the main repository"
      : isSameOrInside(workspaceRoot, isolatedWorkspace)
        ? "workspace root cannot be inside isolated workspace"
        : patch && !isAllowedFileSet(patch)
          ? "patch proposal target files are missing"
          : null;

  if (isolationFailure) {
    return application({
      patchId,
      status: "blocked",
      workspaceRoot,
      isolatedWorkspace,
      simulatedFiles,
      blockedReason: isolationFailure,
    });
  }

  if (!patch) {
    return application({
      patchId,
      status: "blocked",
      workspaceRoot,
      isolatedWorkspace,
      simulatedFiles,
      blockedReason: "patch proposal is missing or malformed",
    });
  }

  try {
    const runner = options.runner ?? createDefaultIsolatedPatchRunner();
    runner.prepareWorkspace(workspaceRoot, isolatedWorkspace);
    const applied = runner.applyPatch(patch, isolatedWorkspace);
    return application({
      patchId,
      status: "applied_isolated",
      workspaceRoot,
      isolatedWorkspace,
      simulatedFiles,
      appliedFiles: applied.appliedFiles,
      diffReport: applied.diffReport,
      blockedReason: null,
    });
  } catch (error) {
    return application({
      patchId,
      status: "blocked",
      workspaceRoot,
      isolatedWorkspace,
      simulatedFiles,
      blockedReason: error instanceof Error ? error.message : "isolated patch application failed",
    });
  }
}

export function renderIsolatedPatchApplicationMarkdown(
  value: IsolatedPatchApplicationJson,
): string {
  return [
    "# Isolated Patch Application",
    "",
    "> Isolated patch application never applies patches to the main working tree. Default mode is dry-run. Execution requires explicit `--execute` and an isolated workspace outside the main repository.",
    "",
    "## Summary",
    "",
    `- Application id: \`${value.application_id}\``,
    `- Patch id: \`${value.patch_id || "unknown"}\``,
    `- Status: \`${value.status}\``,
    `- Workspace root: \`${value.workspace_root || "none"}\``,
    `- Isolated workspace: \`${value.isolated_workspace || "none"}\``,
    `- Did apply: \`${String(value.did_apply)}\``,
    `- Recommended next step: \`${value.recommended_next_step}\``,
    value.blocked_reason ? `- Blocked reason: ${value.blocked_reason}` : "- Blocked reason: none",
    "",
    "## Simulated Files",
    "",
    ...listOrNone(value.simulated_files),
    "",
    "## Applied Files",
    "",
    ...listOrNone(value.applied_files),
    "",
    "## Diff Report",
    "",
    ...listOrNone(value.diff_report),
    "",
    "## Rollback Instruction",
    "",
    value.rollback_instruction,
    "",
    "## Safety Boundary",
    "",
    "- Default mode does not copy or apply files.",
    "- Execution requires explicit `--execute`.",
    "- Patches are never applied to the main working tree.",
    "- No commits are created.",
    "- No push occurs.",
    "- No PR is created.",
    "- No GitHub API calls are made.",
    "- Scheduler, apply, and automerge behavior are not changed.",
    "",
  ].join("\n");
}

export function createDefaultIsolatedPatchRunner(): IsolatedPatchRunner {
  return {
    prepareWorkspace: (workspaceRoot, isolatedWorkspace) => {
      mkdirSync(dirname(isolatedWorkspace), { recursive: true });
      cpSync(workspaceRoot, isolatedWorkspace, {
        recursive: true,
        filter: (source) =>
          !/[\\/]node_modules(?:[\\/]|$)|[\\.]git(?:[\\/]|$)|[\\/]dist(?:[\\/]|$)/.test(source),
      });
    },
    applyPatch: (patch, isolatedWorkspace) => {
      const markerPath = join(isolatedWorkspace, ".clawsweeper-isolated-patch-application.json");
      writeFileSync(markerPath, `${JSON.stringify(sortStable(patch), null, 2)}\n`, "utf8");
      return {
        appliedFiles: [".clawsweeper-isolated-patch-application.json"],
        diffReport: patch.intended_changes.map((item) => `planned: ${item}`),
      };
    },
  };
}

function application(options: {
  patchId: string;
  status: "dry_run" | "applied_isolated" | "blocked" | "needs_review";
  workspaceRoot: string;
  isolatedWorkspace: string;
  simulatedFiles: string[];
  appliedFiles?: string[] | undefined;
  diffReport?: string[] | undefined;
  blockedReason: string | null;
}): IsolatedPatchApplicationJson {
  return {
    application_id: `isolated-patch-${sanitizeSegment(options.patchId || "unknown")}`,
    patch_id: options.patchId,
    status: options.status,
    workspace_root: options.workspaceRoot,
    isolated_workspace: options.isolatedWorkspace,
    did_apply: options.status === "applied_isolated",
    simulated_files: sortStrings(options.simulatedFiles),
    applied_files: sortStrings(options.appliedFiles ?? []),
    diff_report: sortStrings(options.diffReport ?? []),
    rollback_instruction:
      options.status === "applied_isolated"
        ? `Remove isolated workspace: ${options.isolatedWorkspace}`
        : "No isolated patch was applied; no rollback is required.",
    recommended_next_step:
      options.status === "applied_isolated"
        ? "run_local_validation"
        : options.status === "needs_review"
          ? "request_human_review"
          : "stop",
    blocked_reason: options.blockedReason,
  };
}

function parsePatch(value: unknown): PatchProposalJson | undefined {
  if (!isObject(value)) return undefined;
  if (typeof value.patch_id !== "string" || !value.patch_id) return undefined;
  if (!["patch_proposed", "blocked"].includes(String(value.status))) return undefined;
  const filesToModify = stringArray(value.files_to_modify);
  const filesToAdd = stringArray(value.files_to_add);
  return {
    patch_id: value.patch_id,
    plan_id: stringValue(value.plan_id),
    proposal_id: stringValue(value.proposal_id),
    status: value.status as "patch_proposed" | "blocked",
    summary: stringValue(value.summary),
    intended_changes: stringArray(value.intended_changes),
    files_to_modify: filesToModify,
    files_to_add: filesToAdd,
    tests_to_run: stringArray(value.tests_to_run),
    rollback_plan: stringArray(value.rollback_plan),
    safety_constraints: stringArray(value.safety_constraints),
    non_goals: stringArray(value.non_goals),
    blocked_reason: typeof value.blocked_reason === "string" ? value.blocked_reason : null,
  };
}

function parseValidation(value: unknown): { patch_id: string; status: string } | undefined {
  if (!isObject(value)) return undefined;
  if (typeof value.patch_id !== "string") return undefined;
  if (typeof value.status !== "string") return undefined;
  if (!["valid", "blocked", "needs_review"].includes(value.status)) return undefined;
  return { patch_id: value.patch_id, status: value.status };
}

function parseBranchExecution(value: unknown): { status: string } | undefined {
  if (!isObject(value)) return undefined;
  if (typeof value.status !== "string") return undefined;
  if (!["dry_run", "executed", "blocked", "needs_review"].includes(value.status)) return undefined;
  return { status: value.status };
}

function filesFromPatch(patch: PatchProposalJson): string[] {
  return sortStrings([...patch.files_to_modify, ...patch.files_to_add]);
}

function isAllowedFileSet(patch: PatchProposalJson): boolean {
  return filesFromPatch(patch).length > 0;
}

function isSameOrInside(candidate: string, parent: string): boolean {
  const relativePath = relative(parent, candidate);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function sourcePatchId(value: unknown): string {
  if (isObject(value) && typeof value.patch_id === "string" && value.patch_id)
    return value.patch_id;
  return "unknown";
}

function listOrNone(items: readonly string[]): string[] {
  return items.length ? items.map((item) => `- ${item}`) : ["- none"];
}

function sortStrings(items: readonly string[]): string[] {
  return [...new Set(items.filter(Boolean))].sort();
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").sort()
    : [];
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
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
