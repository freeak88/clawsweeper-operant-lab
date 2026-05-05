#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs, stringArg } from "../clawsweeper-args.js";
import { isPolicyPromotionStatus, runPolicyPromotionFromFile } from "./promoter.js";

export {
  canPromotePolicy,
  isPolicyPromotionStatus,
  normalizeProposalStatus,
  promotePolicyProposal,
  runPolicyPromotionFromFile,
} from "./promoter.js";
export type * from "./types.js";

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const proposalPath = stringArg(args.proposal, "");
  const toStatus = stringArg(args.to, "");
  const reason = stringArg(args.reason, "");
  const outputRoot = stringArg(args.output_root, "results/policy-promotions");
  const now = typeof args.now === "string" ? args.now : undefined;
  const operatorDecision =
    typeof args.operator_decision === "string" ? args.operator_decision : undefined;
  const confidenceMetadataPath =
    typeof args.confidence_metadata === "string" ? args.confidence_metadata : undefined;
  const reviewMemoryEvidencePath =
    typeof args.review_memory_evidence === "string" ? args.review_memory_evidence : undefined;

  if (!proposalPath || !reason || !isPolicyPromotionStatus(toStatus)) {
    console.error(
      'Usage: pnpm run policy-promote -- --proposal <path> --to candidate --reason "repeated stable pattern"',
    );
    process.exitCode = 1;
    return;
  }

  const result = runPolicyPromotionFromFile({
    proposalPath,
    toStatus,
    reason,
    outputRoot,
    now,
    operatorDecision,
    confidenceMetadataPath,
    reviewMemoryEvidencePath,
  });

  if (!result.ok) {
    console.error(result.error ?? "Policy promotion failed");
    process.exitCode = 1;
    return;
  }

  console.log(`Policy promotion status: ${result.record?.current_status}`);
  console.log(`Output file: ${result.outputPath}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
