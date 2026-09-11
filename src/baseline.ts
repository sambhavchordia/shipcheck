import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Finding, FindingCode } from "./types.js";

const NEVER_SUPPRESS = new Set<FindingCode>([
  "SECRET_FILE",
  "SECRET_ENV_NOT_IGNORED",
]);

export type BaselineIgnore = {
  code: string;
  file?: string;
};

export type Baseline = {
  version: 1;
  ignore: BaselineIgnore[];
};

export function parseBaseline(raw: unknown): Baseline {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Invalid shipcheck.ok.json: expected an object");
  }
  const obj = raw as { version?: unknown; ignore?: unknown };
  if (obj.version !== 1 && obj.version !== undefined) {
    throw new Error("Invalid shipcheck.ok.json: version must be 1");
  }
  if (obj.ignore === undefined) {
    return { version: 1, ignore: [] };
  }
  if (!Array.isArray(obj.ignore)) {
    throw new Error("Invalid shipcheck.ok.json: ignore must be an array");
  }
  const ignore: BaselineIgnore[] = [];
  for (const item of obj.ignore) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("Invalid shipcheck.ok.json: ignore entries must be objects");
    }
    const entry = item as { code?: unknown; file?: unknown };
    if (typeof entry.code !== "string") {
      throw new Error("Invalid shipcheck.ok.json: ignore.code must be a string");
    }
    const file = typeof entry.file === "string" ? entry.file : undefined;
    ignore.push(file ? { code: entry.code, file } : { code: entry.code });
  }
  return { version: 1, ignore };
}

export function loadBaseline(root: string): Baseline | null {
  const file = join(root, "shipcheck.ok.json");
  if (!existsSync(file)) return null;
  try {
    return parseBaseline(JSON.parse(readFileSync(file, "utf8")) as unknown);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Invalid shipcheck.ok.json")) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid shipcheck.ok.json: ${msg}`);
  }
}

export function findingIsBaselined(f: Finding, baseline: Baseline): boolean {
  if (NEVER_SUPPRESS.has(f.code)) return false;
  return baseline.ignore.some((entry) => {
    if (entry.code !== f.code) return false;
    if (entry.file === undefined) return true;
    return entry.file === f.file;
  });
}

export function applyBaseline(findings: Finding[], baseline: Baseline | null): Finding[] {
  if (!baseline) return findings;
  return findings.filter((f) => !findingIsBaselined(f, baseline));
}

export function writeBaseline(root: string, findings: Finding[]): string {
  const ignore: BaselineIgnore[] = [];
  for (const f of findings) {
    if (f.severity === "info") continue;
    if (NEVER_SUPPRESS.has(f.code)) continue;
    ignore.push({ code: f.code, file: f.file });
  }
  const body: Baseline = { version: 1, ignore };
  const file = join(root, "shipcheck.ok.json");
  writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`);
  return file;
}
