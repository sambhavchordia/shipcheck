import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type FailOn = "error" | "warn";

export type ShipcheckConfig = {
  ignorePaths: string[];
  ignoreRoutes: string[];
  failOn: FailOn;
  envExample?: string;
};

export const defaultConfig: ShipcheckConfig = {
  ignorePaths: [],
  ignoreRoutes: [],
  failOn: "error",
};

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((p): p is string => typeof p === "string")) {
    return [];
  }
  return value;
}

export function parseConfig(raw: unknown): ShipcheckConfig {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ignorePaths: [], ignoreRoutes: [], failOn: "error" };
  }
  const obj = raw as {
    failOn?: unknown;
    ignorePaths?: unknown;
    ignoreRoutes?: unknown;
    envExample?: unknown;
  };
  const failOn: FailOn =
    obj.failOn === "warn" || obj.failOn === "error" ? obj.failOn : "error";
  const envExample =
    typeof obj.envExample === "string" && obj.envExample.trim()
      ? obj.envExample
      : undefined;
  return {
    failOn,
    ignorePaths: stringArray(obj.ignorePaths),
    ignoreRoutes: stringArray(obj.ignoreRoutes),
    ...(envExample ? { envExample } : {}),
  };
}

export function loadConfig(root: string): ShipcheckConfig {
  const file = join(root, "shipcheck.config.json");
  if (!existsSync(file)) {
    return { ignorePaths: [], ignoreRoutes: [], failOn: "error" };
  }
  try {
    return parseConfig(JSON.parse(readFileSync(file, "utf8")) as unknown);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid shipcheck.config.json: ${msg}`);
  }
}

export function normalizeIgnorePath(p: string): string {
  return p.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

/** Secrets walk: relative path equals an entry or is under `entry/`. */
export function pathIsIgnored(relPath: string, ignorePaths: string[]): boolean {
  const rel = normalizeIgnorePath(relPath);
  if (!rel) return false;
  for (const raw of ignorePaths) {
    const entry = normalizeIgnorePath(raw);
    if (!entry) continue;
    if (rel === entry || rel.startsWith(`${entry}/`)) return true;
  }
  return false;
}

export function routeIsIgnored(
  method: string,
  path: string,
  ignoreRoutes: string[],
): boolean {
  const want = `${method.toUpperCase()} ${path}`;
  for (const raw of ignoreRoutes) {
    const t = raw.trim();
    const sp = t.indexOf(" ");
    if (sp <= 0) {
      if (t === path) return true;
      continue;
    }
    const entry = `${t.slice(0, sp).toUpperCase()} ${t.slice(sp + 1)}`;
    if (entry === want) return true;
  }
  return false;
}
