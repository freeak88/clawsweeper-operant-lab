import type { ConfidenceBand, ConfidenceInput, ConfidenceScoreResult } from "./types.js";

const TRUSTED_AUTHOR_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);
const HIGH_CONFIDENCE_VERDICTS = new Set(["keep_open", "close", "complete", "approved"]);
const TERMINAL_FAILURES = new Set([
  "failure",
  "failed",
  "cancelled",
  "timed_out",
  "action_required",
]);
const SENSITIVE_LABELS = new Set(["security", "release-blocker", "beta-blocker"]);
const SENSITIVE_PATH_PATTERNS = [
  /^\.github\/workflows\//,
  /(^|\/)(security|auth|oauth|permissions?)(\/|\.|$)/,
  /(^|\/)(apply|automerge|release)(\/|\.|$)/,
];

export function scoreConfidence(input: ConfidenceInput): ConfidenceScoreResult {
  const reasons: string[] = [`target ${input.confidenceTarget}`];
  const blockingRisks: string[] = [];
  let score = baseScore(input.confidenceTarget);

  const requiredCheckStatus = normalizeValue(input.requiredCheckStatus);
  const checkFailures = normalizeList(input.checkFailures);
  if (requiredCheckStatus && TERMINAL_FAILURES.has(requiredCheckStatus)) {
    blockingRisks.push(`terminal required check status ${requiredCheckStatus}`);
  }
  if (checkFailures.some((failure) => TERMINAL_FAILURES.has(failure) || failure.includes("fail"))) {
    blockingRisks.push(`check failures ${checkFailures.join(", ")}`);
  }

  const drift = normalizeValue(input.snapshotDriftStatus);
  if (drift) {
    if (
      input.confidenceTarget === "safe_close" &&
      (drift.includes("drift") || drift.includes("stale"))
    ) {
      blockingRisks.push(`snapshot drift ${drift}`);
    } else if (drift.includes("drift") || drift.includes("stale")) {
      score -= 0.2;
      reasons.push(`snapshot drift ${drift}`);
    } else {
      score += 0.08;
      reasons.push(`snapshot stable ${drift}`);
    }
  } else {
    score -= 0.05;
    reasons.push("missing snapshot drift status");
  }

  const verdict = normalizeValue(input.reviewVerdict);
  if (verdict && HIGH_CONFIDENCE_VERDICTS.has(verdict)) {
    score += 0.18;
    reasons.push(`high-confidence review verdict ${verdict}`);
  } else if (verdict) {
    score += 0.04;
    reasons.push(`review verdict ${verdict}`);
  } else {
    score -= 0.08;
    reasons.push("missing review verdict");
  }

  const closeReason = normalizeValue(input.safeCloseReason);
  if (input.confidenceTarget === "safe_close") {
    if (closeReason && closeReason !== "none") {
      score += 0.12;
      reasons.push(`safe-close reason ${closeReason}`);
    } else {
      score -= 0.12;
      reasons.push("missing safe-close reason");
    }
  }

  const authorAssociation = normalizeValue(input.authorAssociation).toUpperCase();
  if (TRUSTED_AUTHOR_ASSOCIATIONS.has(authorAssociation)) {
    score += 0.1;
    reasons.push(`trusted author association ${authorAssociation}`);
  } else if (authorAssociation) {
    reasons.push(`author association ${authorAssociation}`);
  } else {
    reasons.push("missing author association");
  }

  const labels = normalizeList(input.labels);
  const sensitiveLabels = labels.filter((label) => SENSITIVE_LABELS.has(label));
  if (sensitiveLabels.length) {
    score -= 0.18;
    reasons.push(`sensitive labels ${sensitiveLabels.join(", ")}`);
  }

  const sensitivePaths = normalizePaths(input.touchedFilePaths).filter((path) =>
    SENSITIVE_PATH_PATTERNS.some((pattern) => pattern.test(path)),
  );
  if (sensitivePaths.length) {
    score -= 0.18;
    reasons.push(`sensitive paths ${sensitivePaths.slice(0, 3).join(", ")}`);
  }

  const priorityBand = normalizeValue(input.priorityBand);
  if (priorityBand === "critical") {
    score -= 0.1;
    reasons.push("critical priority band");
  } else if (priorityBand === "high") {
    score -= 0.04;
    reasons.push("high priority band");
  }

  const routingTier = normalizeValue(input.modelRoutingTier);
  if (routingTier === "high-risk") {
    score -= 0.12;
    reasons.push("high-risk model routing tier");
  } else if (routingTier === "complex") {
    score -= 0.05;
    reasons.push("complex model routing tier");
  }

  const repairMarkers = normalizeList(input.repairMarkers);
  if (repairMarkers.length) {
    score += input.confidenceTarget === "repair_acceptance" ? 0.1 : 0.03;
    reasons.push(`repair markers ${repairMarkers.join(", ")}`);
  }

  const conflictTypes = normalizeList(input.conflictTypes);
  if (conflictTypes.length) {
    score -= 0.08;
    reasons.push(`conflict types ${conflictTypes.join(", ")}`);
  }

  const memoryPatterns = normalizeList(input.reviewMemoryPatterns);
  if (memoryPatterns.some((pattern) => pattern.includes("success") || pattern.includes("merged"))) {
    score += 0.14;
    reasons.push("successful prior review memory");
  } else if (memoryPatterns.length) {
    score += 0.04;
    reasons.push(`review memory patterns ${memoryPatterns.length}`);
  }

  const policyMatches = normalizeList(input.policyRfcMatches);
  if (policyMatches.length) {
    score += 0.06;
    reasons.push(`policy rfc matches ${policyMatches.length}`);
  }

  if (blockingRisks.length) {
    return {
      confidence_target: input.confidenceTarget,
      confidence_score: 0,
      confidence_band: "blocked",
      suggested_action: "blocked",
      confidence_reasons: sortedUnique(reasons),
      blocking_risks: sortedUnique(blockingRisks),
    };
  }

  const confidenceScore = roundScore(clamp01(score));
  const band = confidenceBand(confidenceScore);
  return {
    confidence_target: input.confidenceTarget,
    confidence_score: confidenceScore,
    confidence_band: band,
    suggested_action: suggestedAction(band),
    confidence_reasons: sortedUnique(reasons),
    blocking_risks: [],
  };
}

function baseScore(target: ConfidenceInput["confidenceTarget"]): number {
  switch (target) {
    case "safe_close":
      return 0.45;
    case "repair_acceptance":
      return 0.42;
    case "automerge_readiness":
      return 0.36;
    case "review_verdict":
      return 0.4;
  }
}

function confidenceBand(score: number): ConfidenceBand {
  if (score >= 0.72) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

function suggestedAction(band: ConfidenceBand): ConfidenceScoreResult["suggested_action"] {
  if (band === "high") return "eligible_for_policy_candidate";
  if (band === "medium") return "require_human_review";
  if (band === "blocked") return "blocked";
  return "observe";
}

function normalizeValue(value: string | undefined): string {
  return value?.trim().toLowerCase().replace(/\s+/g, "_") ?? "";
}

function normalizeList(values: readonly string[] | undefined): string[] {
  return sortedUnique((values ?? []).map(normalizeValue).filter(Boolean));
}

function normalizePaths(values: readonly string[] | undefined): string[] {
  return normalizeList(values).map((value) => value.replaceAll("\\", "/"));
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function roundScore(value: number): number {
  return Number(value.toFixed(3));
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}
