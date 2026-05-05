#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs, stringArg } from "../clawsweeper-args.js";
import { evaluateApprovalGate } from "./approver.js";
import { writeApprovalGateOutput } from "./plan-writer.js";
import type { ApprovalGateRunOptions, ApprovalGateRunResult } from "./types.js";

export { evaluateApprovalGate } from "./approver.js";
export { writeApprovalGateOutput } from "./plan-writer.js";
export type * from "./types.js";

export function runApprovalGate(options: ApprovalGateRunOptions): ApprovalGateRunResult {
  const proposal = readJsonIfExists(options.proposalPath);
  const approval = options.approvalPath ? readJsonIfExists(options.approvalPath) : undefined;
  const simulation = options.simulationPath ? readJsonIfExists(options.simulationPath) : undefined;
  const suggestion = options.suggestionPath ? readJsonIfExists(options.suggestionPath) : undefined;
  const output = evaluateApprovalGate({ proposal, approval, simulation, suggestion });
  const outputPath = writeApprovalGateOutput({ output, outputRoot: options.outputRoot });
  return { output, outputPath };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const proposalPath = stringArg(args.proposal, "");
  const approvalPath = stringArg(args.approval, "");
  const simulationPath = stringArg(args.simulation, "");
  const suggestionPath = stringArg(args.suggestion, "");
  const outputRoot = stringArg(args.output_root, "results/approval-gate");

  if (!proposalPath) {
    console.error(
      "Usage: pnpm run approval-gate -- --proposal <path> --approval <path> --output-root <path>",
    );
    process.exitCode = 1;
    return;
  }

  const result = runApprovalGate({
    proposalPath,
    approvalPath: approvalPath || undefined,
    simulationPath: simulationPath || undefined,
    suggestionPath: suggestionPath || undefined,
    outputRoot,
  });
  console.log(`Approval gate output written: ${result.outputPath}`);
  console.log(`Status: ${result.output.status}`);
}

function readJsonIfExists(path: string): unknown {
  const resolved = resolve(path);
  if (!existsSync(resolved)) return undefined;
  return JSON.parse(readFileSync(resolved, "utf8")) as unknown;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
