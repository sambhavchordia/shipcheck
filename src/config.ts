import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type FailOn = "error" | "warn";

export type ShipcheckConfig = {
  ignorePaths: string[];
  failOn: FailOn;
};

export const defaultConfig: ShipcheckConfig = {
  ignorePaths: [],
  failOn: "error",
};

export function parseConfig(raw: unknown): ShipcheckConfig {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ignorePaths: [], failOn: "error" };
  }
  const obj = raw as { failOn?: unknown; ignorePaths?: unknown };
  const failOn: FailOn =
    obj.failOn === "warn" || obj.failOn === "error" ? obj.failOn : "error";
  const ignorePaths =
    Array.isArray(obj.ignorePaths) &&
    obj.ignorePaths.every((p): p is string => typeof p === "string")
      ? obj.ignorePaths
      : [];
  return { failOn, ignorePaths };
}

export function loadConfig(root: string): ShipcheckConfig {
  const file = join(root, "shipcheck.config.json");
  if (!existsSync(file)) return { ignorePaths: [], failOn: "error" };
  return parseConfig(JSON.parse(readFileSync(file, "utf8")) as unknown);
}

export function normalizeIgnorePath(p: string): string {
  return p.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

export function pathIsIgnored(relPath: string, ignorePaths: string[]): boolean {
  const rel = normalizeIgnorePath(relPath);
  if (!rel) return false;
  const parts = rel.split("/").filter(Boolean);
  for (const raw of ignorePaths) {
    const entry = normalizeIgnorePath(raw);
    if (!entry) continue;
    if (rel === entry || rel.startsWith(`${entry}/`)) return true;
    if (parts.includes(entry)) return true;
  }
  return false;
}
