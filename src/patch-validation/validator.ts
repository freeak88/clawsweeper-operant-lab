import type { PatchValidationCheck, PatchValidationInput, PatchValidationJson } from "./types.js";

const REQUIRED_NON_GOALS = [
  "Do not create commits.",
  "Do not create PRs.",
  "Do not merge.",
  "Do not mutate GitHub.",
  "Do not push branches.",
];

const SENSITIVE_PATH_PREFIXES = [
  ".github/workflows/",
  "src/repair/",
  "src/guarded-execution/",
  "src/policy-dsl/",
];

const SENSITIVE_PATH_EXACT = new Set(["src/clawsweeper.ts", "package.json", "pnpm-lock.yaml"]);

export function validatePatchProposal(input: PatchValidationInput | unknown): PatchValidationJson {
  const patchId = patchIdFrom(input);
  const checks: PatchValidationCheck[] = [];
  const blockingRisks: string[] = [];
  const warnings: string[] = [];

  const patch = isObject(input) ? input : {};
  addCheck(checks, "patch proposal status is patch_proposed", patch.status === "patch_proposed");
  if (patch.status === "blocked") blockingRisks.push("patch proposal is blocked");

  for (const field of ["patch_id", "plan_id", "proposal_id", "summary"]) {
    addCheck(
      checks,
      `required field ${field} exists`,
      typeof patch[field] === "string" && patch[field] !== "",
    );
  }

  const filesToModify = stringArray(patch.files_to_modify) ? patch.files_to_modify : undefined;
  const filesToAdd = stringArray(patch.files_to_add) ? patch.files_to_add : undefined;
  const testsToRun = stringArray(patch.tests_to_run) ? patch.tests_to_run : undefined;
  const rollbackPlan = stringArray(patch.rollback_plan) ? patch.rollback_plan : undefined;
  const safetyConstraints = stringArray(patch.safety_constraints)
    ? patch.safety_constraints
    : undefined;
  const nonGoals = stringArray(patch.non_goals) ? patch.non_goals : undefined;

  addCheck(checks, "files_to_modify is an array", Boolean(filesToModify));
  addCheck(checks, "files_to_add is an array", Boolean(filesToAdd));
  addCheck(checks, "tests_to_run is non-empty", Boolean(testsToRun?.length));
  addCheck(checks, "rollback_plan is non-empty", Boolean(rollbackPlan?.length));
  addCheck(checks, "safety_constraints is non-empty", Boolean(safetyConstraints?.length));

  if (!testsToRun?.length) blockingRisks.push("tests_to_run is missing or empty");
  if (!rollbackPlan?.length) blockingRisks.push("rollback_plan is missing or empty");
  if (!safetyConstraints?.length) blockingRisks.push("safety_constraints is missing or empty");

  const missingNonGoals = REQUIRED_NON_GOALS.filter((goal) => !nonGoals?.includes(goal));
  addCheck(
    checks,
    "non_goals include no commit, no push, no PR creation, no merge, no GitHub mutation",
    missingNonGoals.length === 0,
    missingNonGoals.length ? `missing: ${missingNonGoals.join(", ")}` : undefined,
  );
  for (const goal of missingNonGoals) blockingRisks.push(`missing non-goal: ${goal}`);

  const sensitivePaths = [...(filesToModify ?? []), ...(filesToAdd ?? [])]
    .filter(isSensitivePath)
    .sort();
  addCheck(
    checks,
    "proposed files avoid sensitive paths",
    sensitivePaths.length === 0,
    sensitivePaths.length ? `sensitive paths: ${sensitivePaths.join(", ")}` : undefined,
  );
  for (const path of sensitivePaths) warnings.push(`sensitive path requires human review: ${path}`);

  const failedChecks = checks.filter((check) => !check.passed);
  const status =
    blockingRisks.length > 0 || patch.status === "blocked"
      ? "blocked"
      : warnings.length > 0 || sensitivePaths.length > 0
        ? "needs_review"
        : "valid";

  return {
    validation_id: `validation-${patchId}`,
    patch_id: patchId,
    status,
    checks: checks.sort((left, right) => left.check.localeCompare(right.check)),
    blocking_risks: sortedUnique(blockingRisks),
    warnings: sortedUnique(warnings),
    recommended_next_step:
      status === "valid"
        ? "eligible_for_shadow_execution"
        : status === "needs_review"
          ? "request_human_review"
          : "stop",
    summary: summaryFor(status, failedChecks.length, warnings.length),
  };
}

export function renderPatchValidationMarkdown(validation: PatchValidationJson): string {
  return [
    "# Patch Proposal Validation",
    "",
    "> Artifact-only validation. No patch was applied and no source or GitHub state was mutated.",
    "",
    "## Summary",
    "",
    `- Validation id: \`${validation.validation_id}\``,
    `- Patch id: \`${validation.patch_id}\``,
    `- Status: \`${validation.status}\``,
    `- Recommended next step: \`${validation.recommended_next_step}\``,
    `- Summary: ${validation.summary}`,
    "",
    "## Checks",
    "",
    ...validation.checks.map((check) =>
      [`- ${check.passed ? "PASS" : "FAIL"}: ${check.check}`, `  - ${check.message}`].join("\n"),
    ),
    "",
    "## Blocking Risks",
    "",
    bulletList(validation.blocking_risks),
    "",
    "## Warnings",
    "",
    bulletList(validation.warnings),
    "",
    "## Safety Boundary",
    "",
    "- No patch was applied.",
    "- No source files were modified from the patch proposal.",
    "- No commits, pushes, PRs, merges, repairs, or GitHub mutations occurred.",
    "- Scheduler/apply/automerge behavior was not changed.",
    "",
  ].join("\n");
}

function addCheck(
  checks: PatchValidationCheck[],
  check: string,
  passed: boolean,
  message?: string | undefined,
): void {
  checks.push({
    check,
    passed,
    message: message ?? (passed ? "ok" : "failed"),
  });
}

function summaryFor(
  status: PatchValidationJson["status"],
  failedCount: number,
  warningCount: number,
): string {
  if (status === "valid") return "Patch proposal passed artifact-only validation.";
  if (status === "needs_review") {
    return `Patch proposal requires human review due to ${warningCount} warning(s).`;
  }
  return `Patch proposal blocked by ${failedCount} failed check(s).`;
}

function isSensitivePath(path: string): boolean {
  const normalized = path.replaceAll("\\", "/");
  return (
    SENSITIVE_PATH_EXACT.has(normalized) ||
    SENSITIVE_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  );
}

function patchIdFrom(input: unknown): string {
  if (isObject(input) && typeof input.patch_id === "string" && input.patch_id)
    return input.patch_id;
  return "unknown";
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
