import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
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

const DOTENV_EXAMPLES = [".env.example", ".env.sample"];
const SPRING_EXAMPLES = [
  "application-example.yml",
  "application-example.properties",
  "application.yml.example",
  "src/main/resources/application-example.yml",
];
const SPRING_ACTUALS = [
  "application.yml",
  "application.properties",
  "src/main/resources/application.yml",
  "src/main/resources/application.properties",
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

export function flattenYamlScalars(raw: string): Map<string, EnvEntry> {
  const firstDoc = raw.split(/^---\s*$/m)[0] ?? raw;
  const doc: unknown = parseYaml(firstDoc);
  const map = new Map<string, EnvEntry>();
  function walk(node: unknown, prefix: string) {
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) return;
    if (typeof node === "object") {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        const key = prefix ? `${prefix}.${k}` : k;
        walk(v, key);
      }
      return;
    }
    if (typeof node === "string" || typeof node === "number" || typeof node === "boolean") {
      if (prefix) map.set(prefix, { value: String(node), line: 1 });
    }
  }
  walk(doc, "");
  return map;
}

function parseByName(rel: string, raw: string): Map<string, EnvEntry> {
  if (rel.endsWith(".yml") || rel.endsWith(".yaml")) return flattenYamlScalars(raw);
  return parseEnvFile(raw);
}

export function isDummyValue(value: string): boolean {
  return PLACEHOLDERS.includes(value.trim().toLowerCase());
}

function isEmptyOrDummy(value: string): boolean {
  return value.trim().length === 0 || isDummyValue(value);
}

function firstExisting(root: string, rels: string[]): string | undefined {
  return rels.find((n) => existsSync(join(root, n)));
}

export const envCheck: Check = {
  name: "env",
  async run({ root, envExample }) {
    const findings: Finding[] = [];
    const exampleRel = envExample
      ? existsSync(join(root, envExample))
        ? envExample
        : undefined
      : firstExisting(root, DOTENV_EXAMPLES) ?? firstExisting(root, SPRING_EXAMPLES);

    if (!exampleRel) {
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

    const exampleFile = join(root, exampleRel);
    const example = parseByName(exampleRel, readFileSync(exampleFile, "utf8"));
    const dotenvExample = DOTENV_EXAMPLES.includes(exampleRel.replaceAll("\\", "/"))
      || exampleRel.endsWith(".env.example")
      || exampleRel.endsWith(".env.sample");

    let actualRel: string | undefined;
    let actual: Map<string, EnvEntry> | null = null;
    if (dotenvExample) {
      if (existsSync(join(root, ".env"))) {
        actualRel = ".env";
        actual = parseEnvFile(readFileSync(join(root, ".env"), "utf8"));
      }
    } else {
      actualRel = firstExisting(root, SPRING_ACTUALS);
      if (actualRel) {
        actual = parseByName(actualRel, readFileSync(join(root, actualRel), "utf8"));
      }
    }

    if (!actual) {
      findings.push({
        check: "env",
        severity: "warn",
        code: "ENV_MISSING_KEY",
        file: dotenvExample ? ".env" : (SPRING_ACTUALS[0] ?? "application.yml"),
        message: `No .env file. Expected keys from ${exampleRel}: ${[...example.keys()].join(", ") || "(none)"}`,
      });
    } else {
      for (const key of example.keys()) {
        const entry = actual.get(key);
        if (!entry) {
          findings.push({
            check: "env",
            severity: "error",
            code: "ENV_MISSING_KEY",
            file: actualRel ?? ".env",
            message: `Missing key "${key}" that is listed in ${exampleRel}. Value not printed.`,
          });
        } else if (isEmptyOrDummy(entry.value)) {
          findings.push({
            check: "env",
            severity: "error",
            code: "ENV_PLACEHOLDER",
            file: actualRel ?? ".env",
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
          file: exampleRel.replaceAll("\\", "/"),
          line: entry.line,
          message: `Key "${key}" in the example file is a dummy value like changeme. Prefer KEY= with an empty value.`,
        });
      }
    }

    return findings;
  },
};
