import type { PrPackageGeneratorOptions, PrPackageJson, PrPackageStatus } from "./types.js";

const SAFETY_STATEMENT =
  "This package is artifact-only: no push occurred, no PR was created, no GitHub API calls were made, and scheduler/apply/automerge behavior was not changed.";

const DEFAULT_OPERATOR_CHECKLIST = [
  "Review the changed files and diff summary.",
  "Confirm validation evidence matches the intended patch scope.",
  "Confirm rollback plan is acceptable.",
  "Confirm no GitHub mutation has occurred from this package.",
  "Create a PR manually only after human review.",
].sort();

export function generatePrPackage(options: PrPackageGeneratorOptions): PrPackageJson {
  const commitExecution = parseCommitExecution(options.commitExecution);
  const commitIntent = parseCommitIntent(options.commitIntent);
  const validation = parseValidation(options.validation);
  const application = parseApplication(options.application);
  const patch = parsePatch(options.patch);
  const commitIntentId =
    commitExecution?.commit_intent_id ??
    commitIntent?.commit_intent_id ??
    sourceIdFrom(options.commitExecution, options.commitIntent);
  const commitHash = commitExecution?.commit_hash ?? "";
  const title = patch ? titleFor(patch) : "";
  const diffSummary = diffSummaryFor(application);
  const validationEvidence = validationEvidenceFor(commitIntent, validation);
  const rollbackPlan = rollbackPlanFor(commitExecution, application, patch);
  const riskNotes = riskNotesFor(patch);
  const operatorChecklist = DEFAULT_OPERATOR_CHECKLIST;

  if (commitExecution?.status === "needs_review") {
    return prPackage({
      commitIntentId,
      commitHash,
      status: "needs_review",
      title,
      body: "",
      diffSummary,
      validationEvidence,
      rollbackPlan,
      riskNotes,
      operatorChecklist,
      blockedReason: "commit execution requires human review",
    });
  }

  const failure = !commitExecution
    ? "commit execution is missing or malformed"
    : commitExecution.status !== "committed"
      ? `commit execution status is not committed: ${commitExecution.status}`
      : !commitHash
        ? "commit hash is missing"
        : !commitIntent
          ? "commit intent is missing or malformed"
          : commitIntent.status !== "ready"
            ? `commit intent status is not ready: ${commitIntent.status}`
            : !validation
              ? "local validation result is missing or malformed"
              : validation.status !== "passed"
                ? `local validation status is not passed: ${validation.status}`
                : validationEvidence.length === 0
                  ? "validation evidence is missing"
                  : !application
                    ? "isolated patch application is missing or malformed"
                    : application.status !== "applied_isolated"
                      ? `isolated patch application status is not applied_isolated: ${application.status}`
                      : !application.rollback_instruction
                        ? "rollback instruction is missing"
                        : !patch
                          ? "patch proposal is missing or malformed"
                          : patch.status !== "patch_proposed"
                            ? `patch proposal status is not patch_proposed: ${patch.status}`
                            : null;

  if (failure) {
    return prPackage({
      commitIntentId,
      commitHash,
      status: "blocked",
      title,
      body: "",
      diffSummary,
      validationEvidence,
      rollbackPlan,
      riskNotes,
      operatorChecklist,
      blockedReason: failure,
    });
  }

  const readyPackage = prPackage({
    commitIntentId,
    commitHash,
    status: "ready",
    title,
    body: "",
    diffSummary,
    validationEvidence,
    rollbackPlan,
    riskNotes,
    operatorChecklist,
    blockedReason: null,
  });
  return {
    ...readyPackage,
    body: bodyFor({
      title: readyPackage.title,
      commitHash,
      patch: patch!,
      files: filesFor(patch!),
      diffSummary,
      validationEvidence,
      rollbackPlan,
      riskNotes,
      operatorChecklist,
    }),
  };
}

export function renderPrPackageMarkdown(prPackage: PrPackageJson): string {
  return [
    "# PR Package",
    "",
    "> Review package only. No push occurred, no PR was created, no GitHub API call was made, and no source files were mutated by this generator.",
    "",
    "## Summary",
    "",
    `- PR package id: \`${prPackage.pr_package_id}\``,
    `- Commit hash: \`${prPackage.commit_hash || "none"}\``,
    `- Status: \`${prPackage.status}\``,
    `- Title: ${prPackage.title || "none"}`,
    `- Recommended next step: \`${prPackage.recommended_next_step}\``,
    prPackage.blocked_reason
      ? `- Blocked reason: ${prPackage.blocked_reason}`
      : "- Blocked reason: none",
    "",
    "## Diff Summary",
    "",
    bulletList(prPackage.diff_summary),
    "",
    "## Validation Evidence",
    "",
    bulletList(prPackage.validation_evidence),
    "",
    "## Rollback Plan",
    "",
    bulletList(prPackage.rollback_plan),
    "",
    "## Risk Notes",
    "",
    bulletList(prPackage.risk_notes),
    "",
    "## Operator Checklist",
    "",
    bulletList(prPackage.operator_checklist),
    "",
    "## PR Body",
    "",
    prPackage.body || "No PR body generated.",
    "",
    "## Safety Boundary",
    "",
    "- No push occurred.",
    "- No PR was created.",
    "- No GitHub API calls were made.",
    "- No GitHub state was mutated.",
    "- No source files were mutated by this package generator.",
    "- Scheduler, apply, and automerge behavior were not changed.",
    "",
  ].join("\n");
}

interface ParsedCommitExecution {
  commit_intent_id: string;
  status: string;
  commit_hash: string;
  rollback_instruction: string;
}

interface ParsedCommitIntent {
  commit_intent_id: string;
  status: string;
  proposed_commit_message: string;
  files_expected: string[];
  validation_evidence: string[];
}

interface ParsedValidation {
  patch_id: string;
  status: string;
  results: { command: string; exit_code: number; status: string }[];
}

interface ParsedApplication {
  patch_id: string;
  status: string;
  applied_files: string[];
  diff_report: string[];
  rollback_instruction: string;
}

interface ParsedPatch {
  patch_id: string;
  proposal_id: string;
  status: string;
  summary: string;
  files_to_modify: string[];
  files_to_add: string[];
  rollback_plan: string[];
  safety_constraints: string[];
}

function prPackage(options: {
  commitIntentId: string;
  commitHash: string;
  status: PrPackageStatus;
  title: string;
  body: string;
  diffSummary: string[];
  validationEvidence: string[];
  rollbackPlan: string[];
  riskNotes: string[];
  operatorChecklist: string[];
  blockedReason: string | null;
}): PrPackageJson {
  return {
    pr_package_id: `pr-package-${sanitizeSegment(options.commitIntentId || "unknown")}`,
    commit_hash: options.commitHash,
    status: options.status,
    title: options.title,
    body: options.body,
    diff_summary: sortedUnique(options.diffSummary),
    validation_evidence: sortedUnique(options.validationEvidence),
    rollback_plan: sortedUnique(options.rollbackPlan),
    risk_notes: sortedUnique(options.riskNotes),
    operator_checklist: sortedUnique(options.operatorChecklist),
    recommended_next_step:
      options.status === "ready"
        ? "manual_pr_review"
        : options.status === "needs_review"
          ? "request_human_review"
          : "stop",
    blocked_reason: options.blockedReason,
  };
}

function bodyFor(options: {
  title: string;
  commitHash: string;
  patch: ParsedPatch;
  files: string[];
  diffSummary: string[];
  validationEvidence: string[];
  rollbackPlan: string[];
  riskNotes: string[];
  operatorChecklist: string[];
}): string {
  return [
    "## Summary",
    "",
    options.patch.summary || options.title,
    "",
    `Local guarded commit: \`${options.commitHash}\``,
    "",
    "## Changed Files",
    "",
    bulletList(options.files),
    "",
    "## Diff Summary",
    "",
    bulletList(options.diffSummary),
    "",
    "## Validation",
    "",
    bulletList(options.validationEvidence),
    "",
    "## Rollback",
    "",
    bulletList(options.rollbackPlan),
    "",
    "## Risks",
    "",
    bulletList(options.riskNotes),
    "",
    "## Safety Statement",
    "",
    SAFETY_STATEMENT,
    "",
    "## Operator Checklist",
    "",
    bulletList(options.operatorChecklist),
    "",
  ].join("\n");
}

function parseCommitExecution(value: unknown): ParsedCommitExecution | undefined {
  if (!isObject(value)) return undefined;
  if (typeof value.commit_intent_id !== "string" || !value.commit_intent_id) return undefined;
  if (typeof value.status !== "string") return undefined;
  return {
    commit_intent_id: value.commit_intent_id,
    status: value.status,
    commit_hash: typeof value.commit_hash === "string" ? sanitizeCommitHash(value.commit_hash) : "",
    rollback_instruction: stringValue(value.rollback_instruction),
  };
}

function parseCommitIntent(value: unknown): ParsedCommitIntent | undefined {
  if (!isObject(value)) return undefined;
  if (typeof value.commit_intent_id !== "string" || !value.commit_intent_id) return undefined;
  if (typeof value.status !== "string") return undefined;
  if (typeof value.proposed_commit_message !== "string") return undefined;
  return {
    commit_intent_id: value.commit_intent_id,
    status: value.status,
    proposed_commit_message: value.proposed_commit_message,
    files_expected: stringArray(value.files_expected),
    validation_evidence: stringArray(value.validation_evidence),
  };
}

function parseValidation(value: unknown): ParsedValidation | undefined {
  if (!isObject(value)) return undefined;
  if (typeof value.patch_id !== "string" || !value.patch_id) return undefined;
  if (typeof value.status !== "string") return undefined;
  return {
    patch_id: value.patch_id,
    status: value.status,
    results: Array.isArray(value.results)
      ? value.results.filter(isObject).map((item) => ({
          command: stringValue(item.command),
          exit_code: typeof item.exit_code === "number" ? item.exit_code : 1,
          status: stringValue(item.status),
        }))
      : [],
  };
}

function parseApplication(value: unknown): ParsedApplication | undefined {
  if (!isObject(value)) return undefined;
  if (typeof value.patch_id !== "string" || !value.patch_id) return undefined;
  if (typeof value.status !== "string") return undefined;
  return {
    patch_id: value.patch_id,
    status: value.status,
    applied_files: stringArray(value.applied_files),
    diff_report: stringArray(value.diff_report),
    rollback_instruction: stringValue(value.rollback_instruction),
  };
}

function parsePatch(value: unknown): ParsedPatch | undefined {
  if (!isObject(value)) return undefined;
  if (typeof value.patch_id !== "string" || !value.patch_id) return undefined;
  if (typeof value.proposal_id !== "string" || !value.proposal_id) return undefined;
  if (typeof value.status !== "string") return undefined;
  return {
    patch_id: value.patch_id,
    proposal_id: value.proposal_id,
    status: value.status,
    summary: stringValue(value.summary),
    files_to_modify: stringArray(value.files_to_modify),
    files_to_add: stringArray(value.files_to_add),
    rollback_plan: stringArray(value.rollback_plan),
    safety_constraints: stringArray(value.safety_constraints),
  };
}

function titleFor(patch: ParsedPatch): string {
  return `Supervised patch: ${sanitizeTitle(patch.proposal_id)}`;
}

function diffSummaryFor(application: ParsedApplication | undefined): string[] {
  if (!application) return [];
  return sortedUnique([
    ...application.diff_report,
    ...application.applied_files.map((file) => `applied ${file}`),
  ]);
}

function validationEvidenceFor(
  commitIntent: ParsedCommitIntent | undefined,
  validation: ParsedValidation | undefined,
): string[] {
  return sortedUnique([
    ...(commitIntent?.validation_evidence ?? []),
    ...(validation?.results ?? [])
      .filter((item) => item.status === "passed" && item.exit_code === 0)
      .map((item) => `${item.command} passed with exit code ${item.exit_code}`),
  ]);
}

function rollbackPlanFor(
  commitExecution: ParsedCommitExecution | undefined,
  application: ParsedApplication | undefined,
  patch: ParsedPatch | undefined,
): string[] {
  return sortedUnique([
    commitExecution?.rollback_instruction ?? "",
    application?.rollback_instruction ?? "",
    ...(patch?.rollback_plan ?? []),
  ]);
}

function riskNotesFor(patch: ParsedPatch | undefined): string[] {
  return sortedUnique([
    "Manual PR review is required before any remote action.",
    "No remote branch or PR has been created by this package.",
    ...(patch?.safety_constraints ?? []),
  ]);
}

function filesFor(patch: ParsedPatch): string[] {
  return sortedUnique([...patch.files_to_modify, ...patch.files_to_add]);
}

function sanitizeCommitHash(value: string): string {
  return value.replaceAll(/[^a-fA-F0-9]/g, "").toLowerCase();
}

function sanitizeTitle(value: string): string {
  return value
    .replaceAll(/[-_]+/g, " ")
    .replaceAll(/[^a-zA-Z0-9 ]+/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function sanitizeSegment(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9/-]+/g, "-")
    .replaceAll(/\/+/g, "/")
    .replaceAll(/-+/g, "-")
    .replace(/^[-/]+|[-/]+$/g, "");
}

function sourceIdFrom(...values: unknown[]): string {
  for (const value of values) {
    if (isObject(value) && typeof value.commit_intent_id === "string" && value.commit_intent_id) {
      return value.commit_intent_id;
    }
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
