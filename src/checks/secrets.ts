import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { Check, Finding } from "../types.js";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
]);

const SECRET_FILE_NAMES = new Set([
  ".env",
  "id_rsa",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
]);

const SECRET_SUFFIXES = [".pem", ".p12", ".pfx", ".key"];

function walk(dir: string, files: string[]) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, files);
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
  async run({ root }) {
    const findings: Finding[] = [];
    const files: string[] = [];
    walk(root, files);
    const envIgnored = gitignoresEnv(root);

    for (const full of files) {
      const rel = relative(root, full).replaceAll("\\", "/");
      const base = rel.split("/").pop() ?? rel;

      if (base === ".env") {
        if (!envIgnored) {
          findings.push({
            check: "secrets",
            severity: "error",
            file: rel,
            message:
              ".env is present and not listed in .gitignore. Keep it local and commit .env.example only.",
          });
        }
        continue;
      } else if (SECRET_FILE_NAMES.has(base)) {
        findings.push({
          check: "secrets",
          severity: "error",
          file: rel,
          message: `Secret-looking filename "${base}" should not be in the repo.`,
        });
      }

      for (const suffix of SECRET_SUFFIXES) {
        if (base.toLowerCase().endsWith(suffix)) {
          findings.push({
            check: "secrets",
            severity: "error",
            file: rel,
            message: `Secret-looking file suffix "${suffix}".`,
          });
        }
      }
    }

    return findings;
  },
};
