import type { NormalizedDemoRepo } from "./types.js";

const OWNER_REPO = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/;

export function normalizeDemoRepoInput(input: string): NormalizedDemoRepo {
  const trimmed = input.trim();
  const ownerRepo = ownerRepoFromHttps(trimmed) ?? ownerRepoFromSsh(trimmed) ?? trimmed;
  const match = ownerRepo.match(OWNER_REPO);
  if (!match?.[1] || !match[2]) {
    throw new Error(
      "Invalid GitHub repository input. Use https://github.com/owner/repo, git@github.com:owner/repo.git, or owner/repo.",
    );
  }

  const owner = match[1].toLowerCase();
  const repo = match[2].replace(/\.git$/i, "").toLowerCase();
  if (!owner || !repo || repo.includes("/")) {
    throw new Error(`Invalid GitHub repository input: ${input}`);
  }

  return {
    owner,
    repo,
    target_repo: `${owner}/${repo}`,
    repo_slug: `${owner}-${repo}`.replace(/[^a-z0-9_.-]+/g, "-"),
  };
}

function ownerRepoFromHttps(input: string): string | undefined {
  try {
    const url = new URL(input);
    if (url.hostname.toLowerCase() !== "github.com") return undefined;
    const parts = url.pathname.replace(/^\/+/, "").replace(/\/+$/, "").split("/").filter(Boolean);
    if (parts.length < 2) return undefined;
    return `${parts[0]}/${parts[1]?.replace(/\.git$/i, "")}`;
  } catch {
    return undefined;
  }
}

function ownerRepoFromSsh(input: string): string | undefined {
  const match = input.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/i);
  if (!match?.[1] || !match[2]) return undefined;
  return `${match[1]}/${match[2].replace(/\.git$/i, "")}`;
}
