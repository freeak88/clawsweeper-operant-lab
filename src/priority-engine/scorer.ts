import type { PriorityBand, PriorityItemInput, PriorityRiskPathSignal } from "./types.js";

const DEFAULT_NOW = new Date("2026-01-01T00:00:00.000Z");
const HIGH_SIGNAL_LABELS = new Set(["security", "regression", "release-blocker", "beta-blocker"]);
const NORMAL_SIGNAL_LABELS = new Set(["bug", "clawsweeper:autofix", "clawsweeper:automerge"]);
const TRUSTED_AUTHOR_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

export function scorePriority(input: PriorityItemInput): {
  priority_score: number;
  priority_band: PriorityBand;
  priority_reasons: string[];
} {
  const now = parseDate(input.now) ?? DEFAULT_NOW;
  const reasons: string[] = [];
  let score = 0.15;

  const repoWeight = clampWeight(input.repoWeight);
  if (repoWeight > 0) {
    score += repoWeight * 0.2;
    reasons.push(`repo weight ${repoWeight.toFixed(2)}`);
  }

  const labelScore = labelPriority(input.labels, input.labelWeights);
  if (labelScore.score > 0) {
    score += labelScore.score * 0.22;
    reasons.push(...labelScore.reasons);
  } else {
    reasons.push(...labelScore.reasons);
  }

  if (input.itemType === "pull_request") {
    score += 0.08;
    reasons.push("pull request review surface");
  } else if (input.itemType === "issue") {
    score += 0.04;
    reasons.push("issue triage surface");
  } else {
    reasons.push("missing item type");
  }

  const activityScore = recentActivityScore(input.updatedAt, now);
  if (activityScore.score > 0) {
    score += activityScore.score * 0.16;
    reasons.push(activityScore.reason);
  } else {
    reasons.push("missing recent activity timestamp");
  }

  const ageScore = itemAgeScore(input.createdAt, now);
  if (ageScore.score > 0) {
    score += ageScore.score * 0.08;
    reasons.push(ageScore.reason);
  } else {
    reasons.push("missing item age timestamp");
  }

  const staleScore = staleAgeScore(input.staleAt, now);
  if (staleScore.score > 0) {
    score += staleScore.score * 0.12;
    reasons.push(staleScore.reason);
  }

  const authorScore = authorAssociationScore(input.authorAssociation);
  if (authorScore.score > 0) {
    score += authorScore.score * 0.08;
    reasons.push(authorScore.reason);
  } else if (!input.authorAssociation) {
    reasons.push("missing author association");
  }

  const riskScore = riskPathScore(input.riskPathSignals);
  if (riskScore.score > 0) {
    score += riskScore.score * 0.18;
    reasons.push(...riskScore.reasons);
  }

  const priorityScore = roundScore(clamp01(score));
  return {
    priority_score: priorityScore,
    priority_band: priorityBand(priorityScore),
    priority_reasons: sortedUnique(reasons),
  };
}

function labelPriority(
  labels: readonly string[] | undefined,
  labelWeights: Readonly<Record<string, number>> | undefined,
): { score: number; reasons: string[] } {
  const normalizedLabels = (labels ?? []).map(normalizeLabel).filter(Boolean).sort();
  if (!normalizedLabels.length) return { score: 0, reasons: ["no labels"] };

  let score = 0;
  const reasons: string[] = [];
  for (const label of normalizedLabels) {
    const explicitWeight = labelWeights?.[label] ?? labelWeights?.[label.toLowerCase()];
    if (typeof explicitWeight === "number" && Number.isFinite(explicitWeight)) {
      const weight = clampWeight(explicitWeight);
      score = Math.max(score, weight);
      reasons.push(`label ${label} weight ${weight.toFixed(2)}`);
    } else if (HIGH_SIGNAL_LABELS.has(label)) {
      score = Math.max(score, 0.9);
      reasons.push(`high-signal label ${label}`);
    } else if (NORMAL_SIGNAL_LABELS.has(label)) {
      score = Math.max(score, 0.55);
      reasons.push(`priority label ${label}`);
    }
  }

  return { score, reasons: reasons.length ? reasons : ["labels have no priority weight"] };
}

function recentActivityScore(
  updatedAt: string | Date | undefined,
  now: Date,
): { score: number; reason: string } {
  const updated = parseDate(updatedAt);
  if (!updated) return { score: 0, reason: "missing recent activity timestamp" };
  const ageDays = daysBetween(updated, now);
  if (ageDays <= 1) return { score: 1, reason: "activity within 1 day" };
  if (ageDays <= 7) return { score: 0.75, reason: "activity within 7 days" };
  if (ageDays <= 30) return { score: 0.45, reason: "activity within 30 days" };
  return { score: 0.15, reason: "activity older than 30 days" };
}

function itemAgeScore(
  createdAt: string | Date | undefined,
  now: Date,
): { score: number; reason: string } {
  const created = parseDate(createdAt);
  if (!created) return { score: 0, reason: "missing item age timestamp" };
  const ageDays = daysBetween(created, now);
  if (ageDays <= 2) return { score: 0.65, reason: "new item" };
  if (ageDays <= 14) return { score: 0.45, reason: "recent item" };
  if (ageDays <= 90) return { score: 0.25, reason: "established item" };
  return { score: 0.1, reason: "old item" };
}

function staleAgeScore(
  staleAt: string | Date | undefined,
  now: Date,
): { score: number; reason: string } {
  const stale = parseDate(staleAt);
  if (!stale) return { score: 0, reason: "missing stale timestamp" };
  const staleDays = daysBetween(stale, now);
  if (staleDays <= 0) return { score: 0.7, reason: "stale threshold reached" };
  if (staleDays <= 7) return { score: 0.45, reason: "near stale threshold" };
  return { score: 0.1, reason: "not near stale threshold" };
}

function authorAssociationScore(authorAssociation: string | undefined): {
  score: number;
  reason: string;
} {
  if (!authorAssociation) return { score: 0, reason: "missing author association" };
  const normalized = authorAssociation.trim().toUpperCase();
  if (TRUSTED_AUTHOR_ASSOCIATIONS.has(normalized)) {
    return { score: 0.75, reason: `trusted author association ${normalized}` };
  }
  if (normalized === "CONTRIBUTOR") {
    return { score: 0.45, reason: "returning contributor" };
  }
  if (normalized === "FIRST_TIME_CONTRIBUTOR" || normalized === "FIRST_TIMER") {
    return { score: 0.25, reason: "first-time contributor" };
  }
  return { score: 0.15, reason: `author association ${normalized}` };
}

function riskPathScore(signals: readonly PriorityRiskPathSignal[] | undefined): {
  score: number;
  reasons: string[];
} {
  const normalized = (signals ?? [])
    .filter((signal) => signal.path.trim())
    .map((signal) => ({
      path: signal.path.trim(),
      weight: clampWeight(signal.weight ?? inferredRiskWeight(signal.path)),
      reason: signal.reason?.trim(),
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
  if (!normalized.length) return { score: 0, reasons: [] };

  return {
    score: Math.max(...normalized.map((signal) => signal.weight)),
    reasons: normalized.map((signal) =>
      signal.reason
        ? `risk path ${signal.path} (${signal.reason})`
        : `risk path ${signal.path} weight ${signal.weight.toFixed(2)}`,
    ),
  };
}

function inferredRiskWeight(path: string): number {
  const normalized = path.replaceAll("\\", "/").toLowerCase();
  if (normalized.includes("security") || normalized.includes("auth")) return 0.9;
  if (normalized.startsWith(".github/workflows/") || normalized.includes("apply")) return 0.8;
  if (normalized.includes("scheduler") || normalized.includes("automerge")) return 0.75;
  if (normalized.endsWith("package.json") || normalized.includes("config/")) return 0.55;
  return 0.35;
}

function priorityBand(score: number): PriorityBand {
  if (score >= 0.85) return "critical";
  if (score >= 0.65) return "high";
  if (score >= 0.35) return "normal";
  return "low";
}

function parseDate(value: string | Date | undefined): Date | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date;
}

function daysBetween(earlier: Date, later: Date): number {
  return Math.max(0, (later.valueOf() - earlier.valueOf()) / 86_400_000);
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

function clampWeight(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return clamp01(value);
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
