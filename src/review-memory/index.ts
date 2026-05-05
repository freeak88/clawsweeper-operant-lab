#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs, stringArg } from "../clawsweeper-args.js";
import { repositoryProfileFor } from "../repository-profiles.js";
import { buildReviewMemoryIndex, writeReviewMemoryIndex } from "./indexer.js";

export { buildReviewMemoryIndex, writeReviewMemoryIndex } from "./indexer.js";
export { findItemMemory, findMemoryPattern, patternsByType } from "./query.js";
export type * from "./types.js";

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const targetRepo = stringArg(args.target_repo, "openclaw/openclaw");
  const profile = repositoryProfileFor(targetRepo);
  const recordsRoot = resolve(stringArg(args.records_root, "records"));
  const policyRfcRoot = resolve(stringArg(args.policy_rfc_root, "results/policy-rfc"));
  const outputRoot = resolve(stringArg(args.output_root, "results/review-memory"));
  const generatedAt = typeof args.generated_at === "string" ? args.generated_at : undefined;
  const { index, outputPath } = writeReviewMemoryIndex({
    recordsRoot,
    policyRfcRoot,
    outputRoot,
    targetRepo,
    generatedAt,
  });
  console.log(`Review memory written: ${outputPath}`);
  console.log(
    `Indexed ${index.summary.record_count} record(s), ${index.summary.item_count} item(s), ${index.summary.pattern_count} pattern(s) for ${profile.targetRepo}.`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
