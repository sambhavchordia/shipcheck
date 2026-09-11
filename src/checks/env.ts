import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Check, Finding } from "../types.js";

const PLACEHOLDERS = [
  "changeme",
  "change-me",
  "replace-me",
  "replace_me",
  "your-secret-here",
  "your_secret_here",
  "todo",
  "xxx",
  "test",
  "secret",
  "password",
];

function parseEnvFile(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map.set(key, value);
  }
  return map;
}

function isDummyValue(value: string): boolean {
  return PLACEHOLDERS.includes(value.trim().toLowerCase());
}

function isEmptyOrDummy(value: string): boolean {
  return value.trim().length === 0 || isDummyValue(value);
}

export const envCheck: Check = {
  name: "env",
  async run({ root }) {
    const findings: Finding[] = [];
    const candidates = [".env.example", ".env.sample"].map((n) => join(root, n));
    const exampleFile = candidates.find((p) => existsSync(p));

    if (!exampleFile) {
      findings.push({
        check: "env",
        severity: "warn",
        file: ".env.example",
        message:
          "No .env.example or .env.sample found. Add one so required keys are documented.",
      });
      return findings;
    }

    const exampleRel = exampleFile.slice(root.length + 1);
    const example = parseEnvFile(readFileSync(exampleFile, "utf8"));
    const envFile = join(root, ".env");
    const env = existsSync(envFile)
      ? parseEnvFile(readFileSync(envFile, "utf8"))
      : null;

    if (!env) {
      findings.push({
        check: "env",
        severity: "warn",
        file: ".env",
        message: `No .env file. Expected keys from ${exampleRel}: ${[...example.keys()].join(", ") || "(none)"}`,
      });
    } else {
      for (const key of example.keys()) {
        if (!env.has(key)) {
          findings.push({
            check: "env",
            severity: "error",
            file: ".env",
            message: `Missing key "${key}" that is listed in ${exampleRel}. Value not printed.`,
          });
        } else if (isEmptyOrDummy(env.get(key) ?? "")) {
          findings.push({
            check: "env",
            severity: "error",
            file: ".env",
            message: `Key "${key}" looks like a placeholder. Value not printed.`,
          });
        }
      }
    }

    for (const [key, value] of example) {
      if (isDummyValue(value)) {
        findings.push({
          check: "env",
          severity: "warn",
          file: exampleRel,
          message: `Key "${key}" in the example file is a dummy value like changeme. Prefer KEY= with an empty value.`,
        });
      }
    }

    return findings;
  },
};