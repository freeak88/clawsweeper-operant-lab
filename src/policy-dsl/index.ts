#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs, stringArg } from "../clawsweeper-args.js";
import { sortStable } from "../stable-json.js";
import { dryRunPolicyDsl } from "./evaluator.js";
import { parsePolicyDsl } from "./parser.js";
import type { PolicyDryRunFileResult } from "./types.js";

export { dryRunPolicyDsl, evaluatePolicyDsl } from "./evaluator.js";
export { parsePolicyDsl } from "./parser.js";
export type * from "./types.js";

export function runPolicyDslDryRunFromFile(options: {
  policyPath: string;
  memoryPath: string;
  outputRoot?: string | undefined;
}): PolicyDryRunFileResult {
  try {
    const policyPath = resolve(options.policyPath);
    const memoryPath = resolve(options.memoryPath);
    if (!existsSync(policyPath)) return { ok: false, error: `Missing policy file: ${policyPath}` };
    if (!existsSync(memoryPath)) return { ok: false, error: `Missing memory file: ${memoryPath}` };

    const policy = parsePolicyDsl(readJson(policyPath));
    const report = dryRunPolicyDsl(policy, readJson(memoryPath) as Record<string, unknown>);
    const outputRoot = resolve(options.outputRoot ?? "results/policy-dsl-dry-run");
    const outputPath = join(outputRoot, `${policy.policy_id}.json`);

    mkdirSync(outputRoot, { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(sortStable(report), null, 2)}\n`);
    return { ok: true, report, outputPath };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const policyPath = stringArg(args.policy, "");
  const memoryPath = stringArg(args.memory, "");
  const outputRoot = stringArg(args.output_root, "results/policy-dsl-dry-run");

  if (!policyPath || !memoryPath) {
    console.error("Usage: pnpm run policy-dsl -- --policy <path> --memory <path>");
    process.exitCode = 1;
    return;
  }

  const result = runPolicyDslDryRunFromFile({
    policyPath,
    memoryPath,
    outputRoot,
  });

  if (!result.ok) {
    console.error(result.error ?? "Policy DSL dry-run failed");
    process.exitCode = 1;
    return;
  }

  console.log(`Policy DSL dry-run written: ${result.outputPath}`);
  console.log(
    `Evaluated ${result.report?.evaluated_count ?? 0} item(s), ${result.report?.matched_count ?? 0} matched.`,
  );
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
