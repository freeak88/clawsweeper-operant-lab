import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

import { repositoryProfileFor, repositoryProfileForSlug } from "../repository-profiles.js";
import { sortStable } from "../stable-json.js";
import type {
  BuildReviewMemoryOptions,
  ReviewMemoryIndex,
  ReviewMemoryItem,
  ReviewMemoryPattern,
  ReviewMemoryPatternType,
  WriteReviewMemoryOptions,
} from "./types.js";

interface LocalRecord {
  absolutePath: string;
  relativePath: string;
  repoSlug: string;
  sourceRecord: string;
  text: string;
}

interface PatternObservation {
  type: ReviewMemoryPatternType;
  value: string;
  itemNumber?: number | undefined;
  targetRepo: string;
  sourceRecord: string;
}

interface MutableItem {
  item_number: number;
  target_repo: string;
  labels: Set<string>;
  verdicts: Set<string>;
  repair_markers: Set<string>;
  conflict_types: Set<string>;
  safe_close_reasons: Set<string>;
  automerge_causes: Set<string>;
  policy_rfc_refs: Set<string>;
}

export function buildReviewMemoryIndex(options: BuildReviewMemoryOptions): ReviewMemoryIndex {
  const profile = repositoryProfileFor(options.targetRepo);
  const records = recordCandidates(options.recordsRoot, new Set([profile.slug]));
  const observations: PatternObservation[] = [];
  const items = new Map<number, MutableItem>();

  for (const record of records) {
    const extracted = observationsFromRecord(record);
    observations.push(...extracted);
    for (const observation of extracted) {
      if (observation.itemNumber === undefined) continue;
      addObservationToItem(items, observation);
    }
  }

  const policyRecords = policyRfcCandidates(options.policyRfcRoot, profile.slug);
  for (const record of policyRecords) {
    const extracted = observationsFromPolicyRfc(record, profile.targetRepo);
    observations.push(...extracted);
    for (const observation of extracted) {
      if (observation.itemNumber === undefined) continue;
      addObservationToItem(items, observation);
    }
  }

  const patterns = patternsFromObservations(observations);
  const memoryItems = [...items.values()].map(finalizeItem).sort(compareItems);

  return {
    schema_version: 1,
    generated_at: normalizedGeneratedAt(options.generatedAt),
    target_repo: profile.targetRepo,
    summary: {
      record_count: records.length + policyRecords.length,
      item_count: memoryItems.length,
      pattern_count: patterns.length,
    },
    patterns,
    items: memoryItems,
  };
}

export function writeReviewMemoryIndex(options: WriteReviewMemoryOptions): {
  index: ReviewMemoryIndex;
  outputPath: string;
} {
  const profile = repositoryProfileFor(options.targetRepo);
  const index = buildReviewMemoryIndex(options);
  const outputPath = join(options.outputRoot, `${profile.slug}.json`);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(sortStable(index), null, 2)}\n`, "utf8");
  return { index, outputPath };
}

function recordCandidates(recordsRoot: string, repoSlugs: Set<string>): LocalRecord[] {
  if (!existsSync(recordsRoot)) return [];
  const records: LocalRecord[] = [];
  for (const repoSlug of safeReadDir(recordsRoot).sort()) {
    if (!repoSlugs.has(repoSlug)) continue;
    const repoRoot = join(recordsRoot, repoSlug);
    if (!safeIsDirectory(repoRoot)) continue;
    for (const absolutePath of walkFiles(repoRoot)) {
      if (!absolutePath.endsWith(".md") && !absolutePath.endsWith(".json")) continue;
      const text = safeRead(absolutePath);
      if (text === null) continue;
      const relativePath = normalizePath(relative(recordsRoot, absolutePath));
      records.push({
        absolutePath,
        relativePath,
        repoSlug,
        sourceRecord: `records/${relativePath}`,
        text,
      });
    }
  }
  return records.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function policyRfcCandidates(policyRfcRoot: string | undefined, repoSlug: string): LocalRecord[] {
  if (!policyRfcRoot || !existsSync(policyRfcRoot)) return [];
  const repoRoot = join(policyRfcRoot, repoSlug);
  if (!safeIsDirectory(repoRoot)) return [];
  return walkFiles(repoRoot)
    .filter((path) => path.endsWith(".md") || path.endsWith(".json"))
    .map((absolutePath) => ({
      absolutePath,
      relativePath: normalizePath(relative(policyRfcRoot, absolutePath)),
      repoSlug,
      sourceRecord: `results/policy-rfc/${normalizePath(relative(policyRfcRoot, absolutePath))}`,
      text: safeRead(absolutePath) ?? "",
    }))
    .filter((record) => record.text)
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function walkFiles(root: string): string[] {
  const files: string[] = [];
  for (const name of safeReadDir(root).sort()) {
    const fullPath = join(root, name);
    if (safeIsDirectory(fullPath)) files.push(...walkFiles(fullPath));
    else files.push(fullPath);
  }
  return files;
}

function observationsFromRecord(record: LocalRecord): PatternObservation[] {
  const targetRepo = repoForSlug(record.repoSlug);
  const itemNumber = itemNumberFromPath(record.relativePath) ?? itemNumberFromText(record.text);
  const observations: PatternObservation[] = [];

  for (const label of frontMatterStringArray(record.text, "labels")) {
    observations.push(observation(record, targetRepo, itemNumber, "label", label));
  }
  for (const verdict of [
    frontMatterValue(record.text, "decision"),
    frontMatterValue(record.text, "review_status"),
    frontMatterValue(record.text, "verdict"),
    ...uniqueMatches(record.text, /clawsweeper-verdict:([a-z0-9_-]+)/gi),
  ]) {
    if (verdict) observations.push(observation(record, targetRepo, itemNumber, "verdict", verdict));
  }
  for (const marker of [
    frontMatterValue(record.text, "work_candidate"),
    ...uniqueMatches(record.text, /clawsweeper-repair:([a-z0-9_-]+)/gi),
    ...jsonStringValues(record.text, "repair_marker"),
    ...jsonStringValues(record.text, "repairMarker"),
  ]) {
    if (marker) {
      observations.push(observation(record, targetRepo, itemNumber, "repair_marker", marker));
    }
  }
  for (const conflictType of [
    ...jsonStringValues(record.text, "conflict_type"),
    ...jsonStringValues(record.text, "conflictType"),
    labeledLineValue(record.text, "conflict type"),
    labeledLineValue(record.text, "file conflict type"),
  ]) {
    if (conflictType) {
      observations.push(observation(record, targetRepo, itemNumber, "conflict_type", conflictType));
    }
  }
  for (const closeReason of [
    frontMatterValue(record.text, "close_reason"),
    frontMatterValue(record.text, "closeReason"),
    labeledLineValue(record.text, "close reason"),
    labeledLineValue(record.text, "safe close reason"),
  ]) {
    if (closeReason) {
      observations.push(
        observation(record, targetRepo, itemNumber, "safe_close_reason", closeReason),
      );
    }
  }
  for (const cause of [
    ...jsonStringValues(record.text, "automerge_cause"),
    ...jsonStringValues(record.text, "automergeCause"),
    ...jsonStringValues(record.text, "automerge_repair_cause"),
    ...jsonStringValues(record.text, "automergeRepairCause"),
    labeledLineValue(record.text, "automerge cause"),
    labeledLineValue(record.text, "automerge repair cause"),
  ]) {
    if (cause) {
      observations.push(observation(record, targetRepo, itemNumber, "automerge_cause", cause));
    }
  }

  return dedupeObservations(observations);
}

function observationsFromPolicyRfc(record: LocalRecord, targetRepo: string): PatternObservation[] {
  const values = [
    jsonStringValue(record.text, "id"),
    jsonStringValue(record.text, "title"),
    markdownTitle(record.text),
  ].filter((value): value is string => Boolean(value));
  const itemNumbers = itemNumbersFromText(record.text);
  const itemNumber = itemNumbers[0];
  return dedupeObservations(
    values.map((value) => ({
      type: "policy_rfc",
      value: normalizeValue(value),
      itemNumber,
      targetRepo,
      sourceRecord: record.sourceRecord,
    })),
  );
}

function observation(
  record: LocalRecord,
  targetRepo: string,
  itemNumber: number | undefined,
  type: ReviewMemoryPatternType,
  rawValue: string,
): PatternObservation {
  return {
    type,
    value: normalizeValue(rawValue),
    itemNumber,
    targetRepo,
    sourceRecord: record.sourceRecord,
  };
}

function dedupeObservations(observations: PatternObservation[]): PatternObservation[] {
  const seen = new Set<string>();
  return observations.filter((candidate) => {
    if (!candidate.value) return false;
    const key = `${candidate.type}\0${candidate.value}\0${candidate.itemNumber ?? ""}\0${candidate.sourceRecord}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function patternsFromObservations(observations: PatternObservation[]): ReviewMemoryPattern[] {
  const groups = new Map<string, PatternObservation[]>();
  for (const observation of observations) {
    const key = `${observation.type}\0${observation.value}`;
    groups.set(key, [...(groups.get(key) ?? []), observation]);
  }
  return [...groups.values()]
    .map((group) => {
      const first = group[0];
      if (!first) throw new Error("empty memory observation group");
      const itemNumbers = new Set(
        group
          .map((observation) => observation.itemNumber)
          .filter((itemNumber): itemNumber is number => itemNumber !== undefined),
      );
      return {
        pattern_type: first.type,
        pattern_value: first.value,
        occurrences: group.length,
        distinct_items: itemNumbers.size,
        source_records: sortedUnique(group.map((observation) => observation.sourceRecord)),
      };
    })
    .sort(comparePatterns);
}

function addObservationToItem(
  items: Map<number, MutableItem>,
  observation: PatternObservation,
): void {
  if (observation.itemNumber === undefined) return;
  const item = itemFor(items, observation.itemNumber, observation.targetRepo);
  switch (observation.type) {
    case "label":
      item.labels.add(observation.value);
      break;
    case "verdict":
      item.verdicts.add(observation.value);
      break;
    case "repair_marker":
      item.repair_markers.add(observation.value);
      break;
    case "conflict_type":
      item.conflict_types.add(observation.value);
      break;
    case "safe_close_reason":
      item.safe_close_reasons.add(observation.value);
      break;
    case "automerge_cause":
      item.automerge_causes.add(observation.value);
      break;
    case "policy_rfc":
      item.policy_rfc_refs.add(observation.value);
      break;
  }
}

function itemFor(
  items: Map<number, MutableItem>,
  itemNumber: number,
  targetRepo: string,
): MutableItem {
  const existing = items.get(itemNumber);
  if (existing) return existing;
  const item: MutableItem = {
    item_number: itemNumber,
    target_repo: targetRepo,
    labels: new Set(),
    verdicts: new Set(),
    repair_markers: new Set(),
    conflict_types: new Set(),
    safe_close_reasons: new Set(),
    automerge_causes: new Set(),
    policy_rfc_refs: new Set(),
  };
  items.set(itemNumber, item);
  return item;
}

function finalizeItem(item: MutableItem): ReviewMemoryItem {
  return {
    item_number: item.item_number,
    target_repo: item.target_repo,
    labels: [...item.labels].sort(),
    verdicts: [...item.verdicts].sort(),
    repair_markers: [...item.repair_markers].sort(),
    conflict_types: [...item.conflict_types].sort(),
    safe_close_reasons: [...item.safe_close_reasons].sort(),
    automerge_causes: [...item.automerge_causes].sort(),
    policy_rfc_refs: [...item.policy_rfc_refs].sort(),
  };
}

function repoForSlug(slug: string): string {
  return repositoryProfileForSlug(slug)?.targetRepo ?? slug.replace("-", "/");
}

function itemNumberFromPath(path: string): number | undefined {
  const match = normalizePath(path).match(/(?:^|\/)(?:items|issues|pulls)\/(\d+)\.(?:md|json)$/);
  return match?.[1] ? Number(match[1]) : undefined;
}

function itemNumberFromText(text: string): number | undefined {
  return itemNumbersFromText(text)[0];
}

function itemNumbersFromText(text: string): number[] {
  const numbers = [
    ...jsonNumberValues(text, "number"),
    ...jsonNumberValues(text, "item_number"),
    ...jsonNumberValues(text, "itemNumber"),
    ...uniqueMatches(text, /#(\d+)\b/g).map(Number),
  ].filter((value) => Number.isInteger(value) && value > 0);
  return [...new Set(numbers)].sort((left, right) => left - right);
}

function safeRead(filePath: string): string | null {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function safeReadDir(dirPath: string): string[] {
  try {
    return readdirSync(dirPath);
  } catch {
    return [];
  }
}

function safeIsDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function normalizePath(path: string): string {
  return path.split(sep).join("/");
}

function frontMatterStringArray(markdown: string, key: string): string[] {
  const raw = frontMatterValue(markdown, key);
  if (!raw) return [];
  if (raw.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed))
        return parsed.filter((value): value is string => typeof value === "string");
    } catch {
      return [];
    }
  }
  return raw
    .split(",")
    .map((value) => normalizeValue(value))
    .filter(Boolean);
}

function frontMatterValue(markdown: string, key: string): string | undefined {
  const frontMatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontMatter?.[1]) return undefined;
  const lines = frontMatter[1].split(/\r?\n/);
  const direct = lines.find((line) => line.toLowerCase().startsWith(`${key.toLowerCase()}:`));
  if (!direct) return undefined;
  return stripQuotes(direct.slice(direct.indexOf(":") + 1).trim());
}

function labeledLineValue(text: string, label: string): string | undefined {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(
    new RegExp(`(?:^|\\n)\\s*(?:[-*]\\s*)?(?:\\*\\*)?${escaped}(?:\\*\\*)?\\s*:\\s*([^\\n]+)`, "i"),
  );
  return match?.[1] ? normalizeValue(match[1]) : undefined;
}

function jsonStringValue(text: string, key: string): string | undefined {
  return jsonStringValues(text, key)[0];
}

function jsonStringValues(text: string, key: string): string[] {
  const values: string[] = [];
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`"${escaped}"\\s*:\\s*"([^"]+)"`, "gi");
  for (const match of text.matchAll(pattern)) {
    if (match[1]) values.push(normalizeValue(match[1]));
  }
  return values;
}

function jsonNumberValues(text: string, key: string): number[] {
  const values: number[] = [];
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`"${escaped}"\\s*:\\s*(\\d+)`, "gi");
  for (const match of text.matchAll(pattern)) {
    if (match[1]) values.push(Number(match[1]));
  }
  return values;
}

function uniqueMatches(text: string, pattern: RegExp): string[] {
  return [
    ...new Set([...text.matchAll(pattern)].map((match) => normalizeValue(match[1] ?? ""))),
  ].filter(Boolean);
}

function markdownTitle(text: string): string | undefined {
  const match = text.match(/^#\s+(.+)$/m);
  return match?.[1] ? normalizeValue(match[1]) : undefined;
}

function normalizeValue(value: string): string {
  return stripQuotes(value)
    .replace(/<!--.*?-->/g, "")
    .replaceAll("`", "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 160);
}

function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, "");
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function normalizedGeneratedAt(value: string | undefined): string {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toISOString();
}

function comparePatterns(left: ReviewMemoryPattern, right: ReviewMemoryPattern): number {
  return (
    left.pattern_type.localeCompare(right.pattern_type) ||
    left.pattern_value.localeCompare(right.pattern_value)
  );
}

function compareItems(left: ReviewMemoryItem, right: ReviewMemoryItem): number {
  return left.item_number - right.item_number || left.target_repo.localeCompare(right.target_repo);
}
