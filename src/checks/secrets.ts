import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pathIsIgnored } from "../config.js";
import { inspectGitEnv, shouldFlagEnvNotIgnored } from "../git-env.js";
import type { Check, Finding } from "../types.js";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  "target",
  ".idea",
]);

const SECRET_FILE_NAMES = new Set([
  ".env",
  "id_rsa",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
]);

const SECRET_SUFFIXES = [".pem", ".p12", ".pfx", ".key"];

function walk(
  dir: string,
  files: string[],
  root: string,
  ignorePaths: string[],
) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const rel = relative(root, full).replaceAll("\\", "/");
    if (pathIsIgnored(rel, ignorePaths)) continue;
    const st = statSync(full);
    if (st.isDirectory()) walk(full, files, root, ignorePaths);
    else files.push(full);
  }
}

function gitignoresEnv(root: string): boolean {
  const gi = join(root, ".gitignore");
  if (!existsSync(gi)) return false;
  return readFileSync(gi, "utf8")
    .split(/\r?\n/)
    .some((line) => {
      const t = line.trim();
      return t === ".env" || t === "/.env" || t === "*.env";
    });
}

export const secretsCheck: Check = {
  name: "secrets",
  async run({ root, ignorePaths }) {
    const findings: Finding[] = [];
    const files: string[] = [];
    walk(root, files, root, ignorePaths);
    const envIgnored = gitignoresEnv(root);
    const git = inspectGitEnv(root);

    for (const full of files) {
      const rel = relative(root, full).replaceAll("\\", "/");
      const base = rel.split("/").pop() ?? rel;

      if (base === ".env") {
        const flag = shouldFlagEnvNotIgnored({
          exists: true,
          gitignoredByFile: envIgnored,
          inWorkTree: git.inWorkTree,
          tracked: git.tracked,
        });
        if (flag) {
          findings.push({
            check: "secrets",
            severity: "error",
            code: "SECRET_ENV_NOT_IGNORED",
            file: rel,
            message: git.tracked
              ? ".env is tracked by git. Keep it local and commit .env.example only."
              : ".env is present and not listed in .gitignore. Keep it local and commit .env.example only.",
          });
        }
        continue;
      } else if (SECRET_FILE_NAMES.has(base)) {
        findings.push({
          check: "secrets",
          severity: "error",
          code: "SECRET_FILE",
          file: rel,
          message: `Secret-looking filename "${base}" should not be in the repo.`,
        });
      }

      for (const suffix of SECRET_SUFFIXES) {
        if (base.toLowerCase().endsWith(suffix)) {
          findings.push({
            check: "secrets",
            severity: "error",
            code: "SECRET_FILE",
            file: rel,
            message: `Secret-looking file suffix "${suffix}".`,
          });
        }
      }
    }

    return findings;
  },
};
