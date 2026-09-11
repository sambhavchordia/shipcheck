import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
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

export type EnvEntry = { value: string; line: number };

export function parseEnvFile(raw: string): Map<string, EnvEntry> {
  const map = new Map<string, EnvEntry>();
  const lines = raw.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
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
    map.set(key, { value, line: i + 1 });
  }
  return map;
}

export function isDummyValue(value: string): boolean {
  return PLACEHOLDERS.includes(value.trim().toLowerCase());
}

function isEmptyOrDummy(value: string): boolean {
  return value.trim().length === 0 || isDummyValue(value);
}

export const envCheck: Check = {
  name: "env",
  async run({ root, envExample }) {
    const findings: Finding[] = [];
    const candidates = envExample
      ? [envExample]
      : [".env.example", ".env.sample"];
    const exampleFile = candidates.map((n) => join(root, n)).find((p) => existsSync(p));

    if (!exampleFile) {
      findings.push({
        check: "env",
        severity: "warn",
        code: "ENV_MISSING_EXAMPLE",
        file: envExample ?? ".env.example",
        message:
          "No .env.example or .env.sample found. Add one so required keys are documented.",
      });
      return findings;
    }

    const exampleRel = relative(root, exampleFile).replaceAll("\\", "/");
    const example = parseEnvFile(readFileSync(exampleFile, "utf8"));
    const envFile = join(root, ".env");
    const env = existsSync(envFile)
      ? parseEnvFile(readFileSync(envFile, "utf8"))
      : null;

    if (!env) {
      findings.push({
        check: "env",
        severity: "warn",
        code: "ENV_MISSING_KEY",
        file: ".env",
        message: `No .env file. Expected keys from ${exampleRel}: ${[...example.keys()].join(", ") || "(none)"}`,
      });
    } else {
      for (const key of example.keys()) {
        const entry = env.get(key);
        if (!entry) {
          findings.push({
            check: "env",
            severity: "error",
            code: "ENV_MISSING_KEY",
            file: ".env",
            message: `Missing key "${key}" that is listed in ${exampleRel}. Value not printed.`,
          });
        } else if (isEmptyOrDummy(entry.value)) {
          findings.push({
            check: "env",
            severity: "error",
            code: "ENV_PLACEHOLDER",
            file: ".env",
            line: entry.line,
            message: `Key "${key}" looks like a placeholder. Value not printed.`,
          });
        }
      }
    }

    for (const [key, entry] of example) {
      if (isDummyValue(entry.value)) {
        findings.push({
          check: "env",
          severity: "warn",
          code: "ENV_EXAMPLE_DUMMY",
          file: exampleRel,
          line: entry.line,
          message: `Key "${key}" in the example file is a dummy value like changeme. Prefer KEY= with an empty value.`,
        });
      }
    }

    return findings;
  },
};
