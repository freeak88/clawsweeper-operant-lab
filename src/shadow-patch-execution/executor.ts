import type {
  ShadowPatchExecutionJson,
  ShadowPatchProposalInput,
  ShadowPatchValidationInput,
  ShadowPatchSimulatedChange,
  ShadowPatchSimulatedTest,
} from "./types.js";

export function executeShadowPatch(options: {
  patch: ShadowPatchProposalInput | unknown;
  validation: ShadowPatchValidationInput | unknown;
}): ShadowPatchExecutionJson {
  const patchId = patchIdFrom(options.patch, options.validation);
  const validationStatus = validationStatusFrom(options.validation);

  if (validationStatus === "needs_review") {
    return nonSimulatedReport({
      patchId,
      status: "needs_review",
      recommendedNextStep: "request_human_review",
      riskNotes: notesFromValidation(options.validation),
      summary: "Patch proposal requires human review before any shadow execution simulation.",
    });
  }

  if (validationStatus !== "valid") {
    return nonSimulatedReport({
      patchId,
      status: "blocked",
      recommendedNextStep: "stop",
      riskNotes: notesFromValidation(options.validation),
      summary: "Patch proposal is blocked; no shadow execution simulation was run.",
    });
  }

  if (!isPatchProposal(options.patch)) {
    return nonSimulatedReport({
      patchId,
      status: "blocked",
      recommendedNextStep: "stop",
      riskNotes: ["patch proposal is missing, malformed, or not patch_proposed"],
      summary: "Patch proposal is malformed; no shadow execution simulation was run.",
    });
  }

  return {
    shadow_execution_id: `shadow-${options.patch.patch_id}`,
    patch_id: options.patch.patch_id,
    status: "simulated",
    simulated_changes: simulatedChanges(options.patch),
    simulated_tests: simulatedTests(options.patch),
    risk_notes: [
      "shadow execution only; no patch was applied",
      "tests were mirrored from tests_to_run and were not executed",
    ],
    recommended_next_step: "eligible_for_operator_pr_creation",
    summary: "Patch proposal shadow simulation completed without applying changes.",
  };
}

export function renderShadowPatchExecutionMarkdown(execution: ShadowPatchExecutionJson): string {
  return [
    "# Shadow Patch Execution",
    "",
    "> Simulation-only report. No patch was applied, no tests were executed, and no source or GitHub state was mutated.",
    "",
    "## Summary",
    "",
    `- Shadow execution id: \`${execution.shadow_execution_id}\``,
    `- Patch id: \`${execution.patch_id}\``,
    `- Status: \`${execution.status}\``,
    `- Recommended next step: \`${execution.recommended_next_step}\``,
    `- Summary: ${execution.summary}`,
    "",
    "## Simulated Changes",
    "",
    bulletList(
      execution.simulated_changes.map(
        (change) => `${change.kind}: ${change.value} (applied: ${change.applied})`,
      ),
    ),
    "",
    "## Simulated Tests",
    "",
    bulletList(
      execution.simulated_tests.map((test) => `${test.command} (executed: ${test.executed})`),
    ),
    "",
    "## Risk Notes",
    "",
    bulletList(execution.risk_notes),
    "",
    "## Safety Boundary",
    "",
    "- No patch was applied to the working tree.",
    "- No source files were modified.",
    "- No tests were executed.",
    "- No commits, pushes, PRs, merges, repairs, or GitHub mutations occurred.",
    "- Scheduler/apply/automerge behavior was not changed.",
    "",
  ].join("\n");
}

function simulatedChanges(patch: PatchProposal): ShadowPatchSimulatedChange[] {
  return [
    ...patch.intended_changes.map((value) => ({
      kind: "intended_change" as const,
      value,
      applied: false as const,
    })),
    ...patch.files_to_modify.map((value) => ({
      kind: "modify" as const,
      value,
      applied: false as const,
    })),
    ...patch.files_to_add.map((value) => ({
      kind: "add" as const,
      value,
      applied: false as const,
    })),
  ].sort(compareChange);
}

function simulatedTests(patch: PatchProposal): ShadowPatchSimulatedTest[] {
  return patch.tests_to_run
    .map((command) => ({ command, executed: false as const }))
    .sort((left, right) => left.command.localeCompare(right.command));
}

function nonSimulatedReport(options: {
  patchId: string;
  status: "blocked" | "needs_review";
  recommendedNextStep: "stop" | "request_human_review";
  riskNotes: string[];
  summary: string;
}): ShadowPatchExecutionJson {
  return {
    shadow_execution_id: `shadow-${options.patchId}`,
    patch_id: options.patchId,
    status: options.status,
    simulated_changes: [],
    simulated_tests: [],
    risk_notes: sortedUnique(options.riskNotes),
    recommended_next_step: options.recommendedNextStep,
    summary: options.summary,
  };
}

function notesFromValidation(value: unknown): string[] {
  if (!isObject(value)) return ["validation input is missing or malformed"];
  const blockingRisks = stringArray(value.blocking_risks) ? value.blocking_risks : [];
  const warnings = stringArray(value.warnings) ? value.warnings : [];
  const notes = [...blockingRisks, ...warnings];
  if (typeof value.summary === "string" && value.summary) notes.push(value.summary);
  return notes.length ? notes : ["validation did not authorize shadow execution"];
}

function validationStatusFrom(value: unknown): string {
  if (!isObject(value) || typeof value.status !== "string") return "blocked";
  return value.status;
}

function patchIdFrom(patch: unknown, validation: unknown): string {
  if (isObject(patch) && typeof patch.patch_id === "string" && patch.patch_id)
    return patch.patch_id;
  if (isObject(validation) && typeof validation.patch_id === "string" && validation.patch_id)
    return validation.patch_id;
  return "unknown";
}

interface PatchProposal {
  patch_id: string;
  status: "patch_proposed";
  intended_changes: string[];
  files_to_modify: string[];
  files_to_add: string[];
  tests_to_run: string[];
}

function isPatchProposal(value: unknown): value is PatchProposal {
  if (!isObject(value)) return false;
  return (
    value.status === "patch_proposed" &&
    typeof value.patch_id === "string" &&
    value.patch_id !== "" &&
    stringArray(value.intended_changes) &&
    stringArray(value.files_to_modify) &&
    stringArray(value.files_to_add) &&
    stringArray(value.tests_to_run)
  );
}

function compareChange(
  left: ShadowPatchSimulatedChange,
  right: ShadowPatchSimulatedChange,
): number {
  return left.kind.localeCompare(right.kind) || left.value.localeCompare(right.value);
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function bulletList(items: readonly string[]): string {
  if (items.length === 0) return "- none";
  return items.map((item) => `- ${item}`).join("\n");
}
