import type {
  ReviewMemoryIndex,
  ReviewMemoryItem,
  ReviewMemoryPattern,
  ReviewMemoryPatternType,
} from "./types.js";

export function findMemoryPattern(
  index: ReviewMemoryIndex,
  patternType: ReviewMemoryPatternType,
  patternValue: string,
): ReviewMemoryPattern | undefined {
  const normalized = normalizeValue(patternValue);
  return index.patterns.find(
    (pattern) =>
      pattern.pattern_type === patternType && normalizeValue(pattern.pattern_value) === normalized,
  );
}

export function findItemMemory(
  index: ReviewMemoryIndex,
  itemNumber: number,
): ReviewMemoryItem | undefined {
  return index.items.find((item) => item.item_number === itemNumber);
}

export function patternsByType(
  index: ReviewMemoryIndex,
  patternType: ReviewMemoryPatternType,
): ReviewMemoryPattern[] {
  return index.patterns.filter((pattern) => pattern.pattern_type === patternType);
}

function normalizeValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
