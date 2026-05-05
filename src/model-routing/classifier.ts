import type { ModelRoutingInput, ModelRoutingRecommendation, ModelRoutingTier } from "./types.js";

const HIGH_RISK_LABELS = new Set(["security", "release-blocker", "beta-blocker"]);
const COMPLEX_LABELS = new Set(["regression", "bug", "clawsweeper:autofix"]);
const HIGH_RISK_PATH_PATTERNS = [
  /^\.github\/workflows\//,
  /(^|\/)(security|auth|oauth|permission|permissions)(\/|\.|$)/,
  /(^|\/)(automerge|apply|release)(\/|\.|$)/,
];
const COMPLEX_PATH_PATTERNS = [
  /(^|\/)(scheduler|repair|workflow|config)(\/|\.|$)/,
  /(^|\/)package\.json$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)tsconfig[^/]*\.json$/,
];

export function classifyModelRouting(input: ModelRoutingInput): ModelRoutingRecommendation {
  const reasons: string[] = [];
  let riskScore = 0;
  const labels = normalizeList(input.labels);
  const paths = normalizePaths(input.touchedFilePaths);
  const memoryPatterns = normalizeList(input.reviewMemoryPatterns);
  const repairMarkers = normalizeList(input.repairMarkers);
  const conflictTypes = normalizeList(input.conflictTypes);
  const checkFailures = normalizeList(input.checkFailureMarkers);
  let highRiskSignal = false;

  const priority = prioritySignal(input.priorityScore, input.priorityBand);
  riskScore += priority.score;
  reasons.push(priority.reason);
  if (priority.highRisk) highRiskSignal = true;

  if (input.itemType === "pull_request") {
    riskScore += 1;
    reasons.push("pull request review surface");
  } else if (input.itemType === "issue") {
    reasons.push("issue triage surface");
  } else {
    reasons.push("missing item type");
  }

  for (const label of labels) {
    if (HIGH_RISK_LABELS.has(label)) {
      riskScore += 4;
      highRiskSignal = true;
      reasons.push(`high-risk label ${label}`);
    } else if (COMPLEX_LABELS.has(label)) {
      riskScore += 2;
      reasons.push(`complexity label ${label}`);
    }
  }
  if (!labels.length) reasons.push("no labels");

  const highRiskPaths = paths.filter((path) =>
    HIGH_RISK_PATH_PATTERNS.some((pattern) => pattern.test(path)),
  );
  const complexPaths = paths.filter((path) =>
    COMPLEX_PATH_PATTERNS.some((pattern) => pattern.test(path)),
  );
  if (highRiskPaths.length) {
    riskScore += 5;
    highRiskSignal = true;
    reasons.push(`sensitive path ${highRiskPaths[0]}`);
  }
  if (complexPaths.length) {
    riskScore += 3;
    reasons.push(`complex path ${complexPaths[0]}`);
  }
  if (paths.length >= 8) {
    riskScore += 3;
    reasons.push(`broad change touches ${paths.length} files`);
  }

  if (memoryPatterns.length) {
    riskScore += 1;
    reasons.push(`review memory patterns ${memoryPatterns.length}`);
  }
  if (repairMarkers.length) {
    riskScore += 2;
    reasons.push(`prior repair markers ${repairMarkers.join(", ")}`);
  }
  if (conflictTypes.length) {
    riskScore += 2;
    reasons.push(`conflict types ${conflictTypes.join(", ")}`);
  }
  if (checkFailures.length) {
    riskScore += 3;
    reasons.push(`check failure markers ${checkFailures.join(", ")}`);
  }

  const tier = tierForScore(riskScore, highRiskSignal);
  return {
    routing_tier: tier,
    ...recommendationForTier(tier),
    routing_reasons: sortedUnique(reasons),
  };
}

function prioritySignal(
  priorityScore: number | undefined,
  priorityBand: string | undefined,
): {
  score: number;
  reason: string;
  highRisk: boolean;
} {
  const band = priorityBand?.trim().toLowerCase();
  if (band === "critical") return { score: 5, reason: "critical priority band", highRisk: true };
  if (band === "high") return { score: 3, reason: "high priority band", highRisk: false };
  if (typeof priorityScore === "number" && Number.isFinite(priorityScore)) {
    if (priorityScore >= 0.85)
      return { score: 5, reason: `priority score ${priorityScore.toFixed(3)}`, highRisk: true };
    if (priorityScore >= 0.65)
      return { score: 3, reason: `priority score ${priorityScore.toFixed(3)}`, highRisk: false };
    if (priorityScore >= 0.35)
      return { score: 1, reason: `priority score ${priorityScore.toFixed(3)}`, highRisk: false };
    return { score: 0, reason: `priority score ${priorityScore.toFixed(3)}`, highRisk: false };
  }
  return { score: 0, reason: "missing priority metadata", highRisk: false };
}

function tierForScore(score: number, highRiskSignal: boolean): ModelRoutingTier {
  if (highRiskSignal && score >= 8) return "high-risk";
  if (score >= 5) return "complex";
  if (score >= 2) return "standard";
  return "trivial";
}

function recommendationForTier(tier: ModelRoutingTier): {
  recommended_model: string;
  recommended_reasoning_effort: "low" | "medium" | "high";
} {
  switch (tier) {
    case "trivial":
      return { recommended_model: "gpt-5.4-mini", recommended_reasoning_effort: "low" };
    case "standard":
      return { recommended_model: "gpt-5.5", recommended_reasoning_effort: "medium" };
    case "complex":
      return { recommended_model: "gpt-5.5", recommended_reasoning_effort: "high" };
    case "high-risk":
      return { recommended_model: "gpt-5.5", recommended_reasoning_effort: "high" };
  }
}

function normalizeList(values: readonly string[] | undefined): string[] {
  return sortedUnique((values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean));
}

function normalizePaths(values: readonly string[] | undefined): string[] {
  return normalizeList(values).map((value) => value.replaceAll("\\", "/"));
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}
