import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

import type { GovernanceArtifact, GovernanceCollection, GovernanceLayerStage } from "./types.js";

interface LayerSpec {
  layer_id: string;
  name: string;
  stage: GovernanceLayerStage;
  filenames: string[];
}

export const GOVERNANCE_LAYER_SPECS: readonly LayerSpec[] = [
  {
    layer_id: "review_memory",
    name: "Review Memory",
    stage: "evidence",
    filenames: ["review-memory.json"],
  },
  {
    layer_id: "policy_rfc",
    name: "Policy RFCs",
    stage: "proposal",
    filenames: ["policy-rfc.json", "policy-proposal.json", "policy-rfc-proposal.json"],
  },
  {
    layer_id: "promotion",
    name: "Policy Promotion",
    stage: "approval",
    filenames: ["policy-promotion.json"],
  },
  {
    layer_id: "dsl",
    name: "Policy DSL",
    stage: "simulation",
    filenames: ["policy-dsl-dry-run.json", "policy-dsl.json"],
  },
  {
    layer_id: "shadow_runtime",
    name: "Shadow Runtime",
    stage: "simulation",
    filenames: ["shadow-runtime.json"],
  },
  {
    layer_id: "shadow_metrics",
    name: "Shadow Metrics",
    stage: "simulation",
    filenames: ["shadow-metrics.json"],
  },
  {
    layer_id: "confidence",
    name: "Confidence",
    stage: "evidence",
    filenames: ["confidence-engine.json", "confidence.json"],
  },
  {
    layer_id: "guarded_execution",
    name: "Guarded Execution",
    stage: "safety",
    filenames: ["guarded-execution.json"],
  },
  {
    layer_id: "improvement_loop",
    name: "Improvement Loop",
    stage: "proposal",
    filenames: ["improvement-loop.json"],
  },
  {
    layer_id: "approval_gate",
    name: "Approval Gate",
    stage: "approval",
    filenames: ["approval-gate.json", "implementation-plan.json"],
  },
  {
    layer_id: "implementation_writer",
    name: "Implementation Writer",
    stage: "intent",
    filenames: ["implementation-prompt.json"],
  },
  {
    layer_id: "patch_generation",
    name: "Patch Generation",
    stage: "proposal",
    filenames: ["patch-proposal.json"],
  },
  {
    layer_id: "patch_validation",
    name: "Patch Validation",
    stage: "approval",
    filenames: ["patch-validation.json"],
  },
  {
    layer_id: "shadow_patch_execution",
    name: "Shadow Patch Execution",
    stage: "simulation",
    filenames: ["shadow-patch-execution.json"],
  },
  {
    layer_id: "pr_creation_intent",
    name: "PR Creation Intent",
    stage: "intent",
    filenames: ["pr-creation-intent.json"],
  },
  {
    layer_id: "supervised_patch_pipeline_demo",
    name: "Supervised Patch Pipeline Demo",
    stage: "intent",
    filenames: ["supervised-patch-pipeline-demo.json"],
  },
];

export function collectGovernanceArtifacts(inputRoot: string): GovernanceCollection {
  const root = resolve(inputRoot);
  const jsonFiles = existsSync(root) ? listJsonFiles(root).sort() : [];
  const artifacts: GovernanceArtifact[] = [];

  for (const spec of GOVERNANCE_LAYER_SPECS) {
    const matches = jsonFiles.filter((file) =>
      spec.filenames.includes(file.split(/[\\/]/).at(-1) ?? ""),
    );
    const artifactPath = matches.at(-1);
    if (!artifactPath) continue;
    const data = readJsonObject(artifactPath);
    if (!data) continue;
    artifacts.push({
      layer_id: spec.layer_id,
      name: spec.name,
      stage: spec.stage,
      artifact_path: relative(root, artifactPath).replaceAll("\\", "/"),
      data,
    });
  }

  return {
    input_root: root,
    artifacts,
  };
}

function listJsonFiles(root: string): string[] {
  const files: string[] = [];
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const path = `${dir}\\${entry}`;
      const stat = statSync(path);
      if (stat.isDirectory()) {
        visit(path);
      } else if (entry.endsWith(".json")) {
        files.push(path);
      }
    }
  };
  visit(root);
  return files;
}

function readJsonObject(path: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    return isObject(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
