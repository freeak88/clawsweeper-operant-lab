import type { CommitIntentJson, CommitIntentPlannerOptions, CommitIntentStatus } from "./types.js";

export function planCommitIntent(options: CommitIntentPlannerOptions): CommitIntentJson {
  const validation = parseValidation(options.validation);
  const application = parseApplication(options.application);
  const patch = parsePatch(options.patch);
  const patchId =
    patch?.patch_id ??
    validation?.patch_id ??
    application?.patch_id ??
    sourcePatchId(options.patch);
  const filesExpected = patch
    ? sortedUnique([...patch.files_to_modify, ...patch.files_to_add])
    : [];
  const validationEvidence = validation ? evidenceFrom(validation) : [];
  const proposedCommitMessage = patch ? commitMessageFor(patch) : "";
  const rollbackNote = rollbackNoteFor(application, patch);

  if (validation?.status === "needs_review" || application?.status === "needs_review") {
    return intent({
      patchId,
      status: "needs_review",
      proposedCommitMessage,
      filesExpected,
      validationEvidence,
      rollbackNote,
      blockedReason: "upstream artifact requires human review",
    });
  }

  const failure = !validation
    ? "local validation result is missing or malformed"
    : validation.status !== "passed"
      ? `local validation status is not passed: ${validation.status}`
      : !application
        ? "isolated patch application is missing or malformed"
        : application.status !== "applied_isolated"
          ? `isolated patch application status is not applied_isolated: ${application.status}`
          : !patch
            ? "patch proposal is missing or malformed"
            : patch.status !== "patch_proposed"
              ? `patch proposal status is not patch_proposed: ${patch.status}`
              : validationEvidence.length === 0
                ? "validation evidence is missing"
                : filesExpected.length === 0
                  ? "expected files are missing"
                  : null;

  if (failure) {
    return intent({
      patchId,
      status: "blocked",
      proposedCommitMessage,
      filesExpected,
      validationEvidence,
      rollbackNote,
      blockedReason: failure,
    });
  }

  return intent({
    patchId,
    status: "ready",
    proposedCommitMessage,
    filesExpected,
    validationEvidence,
    rollbackNote,
    blockedReason: null,
  });
}

export function renderCommitIntentMarkdown(intent: CommitIntentJson): string {
  return [
    "# Commit Intent",
    "",
    "> Reviewable commit package only. No files were staged, no commit was created, no push occurred, no PR was created, and no GitHub state was mutated.",
    "",
    "## Summary",
    "",
    `- Commit intent id: \`${intent.commit_intent_id}\``,
    `- Patch id: \`${intent.patch_id || "unknown"}\``,
    `- Status: \`${intent.status}\``,
    `- Proposed commit message: \`${intent.proposed_commit_message || "none"}\``,
    `- Recommended next step: \`${intent.recommended_next_step}\``,
    intent.blocked_reason ? `- Blocked reason: ${intent.blocked_reason}` : "- Blocked reason: none",
    "",
    "## Files Expected",
    "",
    ...listOrNone(intent.files_expected),
    "",
    "## Validation Evidence",
    "",
    ...listOrNone(intent.validation_evidence),
    "",
    "## Rollback Note",
    "",
    intent.rollback_note,
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

function intent(options: {
  patchId: string;
  status: CommitIntentStatus;
  proposedCommitMessage: string;
  filesExpected: string[];
  validationEvidence: string[];
  rollbackNote: string;
  blockedReason: string | null;
}): CommitIntentJson {
  return {
    commit_intent_id: `commit-intent-${sanitizeSegment(options.patchId || "unknown")}`,
    patch_id: options.patchId,
    status: options.status,
    proposed_commit_message: options.proposedCommitMessage,
    files_expected: sortedUnique(options.filesExpected),
    validation_evidence: sortedUnique(options.validationEvidence),
    rollback_note: options.rollbackNote,
    recommended_next_step:
      options.status === "ready"
        ? "manual_commit_review"
        : options.status === "needs_review"
          ? "request_human_review"
          : "stop",
    blocked_reason: options.blockedReason,
  };
}

interface ParsedValidation {
  patch_id: string;
  status: string;
  results: { command: string; exit_code: number; status: string; output: string }[];
}

interface ParsedApplication {
  patch_id: string;
  status: string;
  rollback_instruction: string;
  isolated_workspace: string;
}

interface ParsedPatch {
  patch_id: string;
  status: string;
  proposal_id: string;
  summary: string;
  files_to_modify: string[];
  files_to_add: string[];
  rollback_plan: string[];
}

function parseValidation(value: unknown): ParsedValidation | undefined {
  if (!isObject(value)) return undefined;
  if (typeof value.patch_id !== "string" || !value.patch_id) return undefined;
  if (typeof value.status !== "string") return undefined;
  if (!["dry_run", "passed", "failed", "blocked", "needs_review"].includes(value.status))
    return undefined;
  return {
    patch_id: value.patch_id,
    status: value.status,
    results: resultArray(value.results),
  };
}

function parseApplication(value: unknown): ParsedApplication | undefined {
  if (!isObject(value)) return undefined;
  if (typeof value.patch_id !== "string" || !value.patch_id) return undefined;
  if (typeof value.status !== "string") return undefined;
  if (!["dry_run", "applied_isolated", "blocked", "needs_review"].includes(value.status))
    return undefined;
  return {
    patch_id: value.patch_id,
    status: value.status,
    rollback_instruction: stringValue(value.rollback_instruction),
    isolated_workspace: stringValue(value.isolated_workspace),
  };
}

function parsePatch(value: unknown): ParsedPatch | undefined {
  if (!isObject(value)) return undefined;
  if (typeof value.patch_id !== "string" || !value.patch_id) return undefined;
  if (typeof value.status !== "string") return undefined;
  if (!["patch_proposed", "blocked"].includes(value.status)) return undefined;
  return {
    patch_id: value.patch_id,
    status: value.status,
    proposal_id: stringValue(value.proposal_id),
    summary: stringValue(value.summary),
    files_to_modify: stringArray(value.files_to_modify),
    files_to_add: stringArray(value.files_to_add),
    rollback_plan: stringArray(value.rollback_plan),
  };
}

function evidenceFrom(validation: ParsedValidation): string[] {
  return validation.results
    .filter((item) => item.status === "passed" && item.exit_code === 0)
    .map((item) => `${item.command} passed with exit code ${item.exit_code}`)
    .sort();
}

function commitMessageFor(patch: ParsedPatch): string {
  const subject = sanitizeCommitSubject(patch.proposal_id || patch.patch_id);
  return `feat: ${subject}`;
}

function sanitizeCommitSubject(value: string): string {
  const cleaned = value
    .replace(/^improve[-_]/i, "improve ")
    .replace(/^patch[-_]/i, "apply ")
    .replaceAll(/[-_]+/g, " ")
    .replaceAll(/[^a-zA-Z0-9 ]+/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return cleaned || "apply supervised patch";
}

function rollbackNoteFor(
  application: ParsedApplication | undefined,
  patch: ParsedPatch | undefined,
): string {
  const notes = [
    application?.rollback_instruction,
    ...(patch?.rollback_plan ?? []),
    "No commit has been created; discard this intent artifact if the operator rejects it.",
  ].filter((item): item is string => typeof item === "string" && item.length > 0);
  return sortedUnique(notes).join(" ");
}

function resultArray(value: unknown): ParsedValidation["results"] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isObject)
    .map((item) => ({
      command: stringValue(item.command),
      exit_code: typeof item.exit_code === "number" ? item.exit_code : 1,
      status: stringValue(item.status),
      output: stringValue(item.output),
    }))
    .filter((item) => item.command.length > 0)
    .sort((left, right) => left.command.localeCompare(right.command));
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").sort()
    : [];
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function sourcePatchId(value: unknown): string {
  if (isObject(value) && typeof value.patch_id === "string" && value.patch_id)
    return value.patch_id;
  return "unknown";
}

function listOrNone(items: readonly string[]): string[] {
  return items.length ? items.map((item) => `- ${item}`) : ["- none"];
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
