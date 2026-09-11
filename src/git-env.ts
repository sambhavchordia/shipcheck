import { spawnSync } from "node:child_process";

export type EnvGitDecision = {
  exists: boolean;
  gitignoredByFile: boolean;
  inWorkTree: boolean;
  tracked: boolean;
};

/** Tracked .env is always an error. Untracked uses the target .gitignore file, not git check-ignore. */
export function shouldFlagEnvNotIgnored(opts: EnvGitDecision): boolean {
  if (!opts.exists) return false;
  if (opts.inWorkTree && opts.tracked) return true;
  if (!opts.gitignoredByFile) return true;
  return false;
}

export function inspectGitEnv(root: string): { inWorkTree: boolean; tracked: boolean } {
  try {
    const inside = spawnSync(
      "git",
      ["-C", root, "rev-parse", "--is-inside-work-tree"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], windowsHide: true },
    );
    if (inside.status !== 0 || inside.stdout.trim() !== "true") {
      return { inWorkTree: false, tracked: false };
    }
    const ls = spawnSync(
      "git",
      ["-C", root, "ls-files", "--error-unmatch", "--", ".env"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], windowsHide: true },
    );
    return { inWorkTree: true, tracked: ls.status === 0 };
  } catch {
    return { inWorkTree: false, tracked: false };
  }
}
