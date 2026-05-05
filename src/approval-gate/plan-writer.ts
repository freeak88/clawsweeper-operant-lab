import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { sortStable } from "../stable-json.js";
import type { ApprovalGateOutput } from "./types.js";

export function writeApprovalGateOutput(options: {
  output: ApprovalGateOutput;
  outputRoot: string;
}): string {
  const outputPath = join(resolve(options.outputRoot), `${options.output.proposal_id}.json`);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(sortStable(options.output), null, 2)}\n`, "utf8");
  return outputPath;
}
