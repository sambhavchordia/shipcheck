import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  isMap,
  isScalar,
  LineCounter,
  parseDocument,
} from "yaml";
import { routeIsIgnored } from "../config.js";
import type { Check, Finding } from "../types.js";
import { springJavaRoutes } from "./spring.js";

export type Route = { method: string; path: string; line?: number };

const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "HEAD",
] as const;

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  "fixtures",
  "target",
  ".idea",
]);

function walk(dir: string, files: string[]) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, files);
    else files.push(full);
  }
}

export function normalizePath(p: string): string {
  let out = p.trim();
  if (!out.startsWith("/")) out = `/${out}`;
  if (out.length > 1 && out.endsWith("/")) out = out.slice(0, -1);
  return out;
}

/** Map App Router / pages segments: [id] → {id}, [...slug] → {slug}, omit (group). */
export function nextSegmentToOpenApi(seg: string): string | null {
  if (/^\([^)]+\)$/.test(seg)) return null;
  const optionalCatch = seg.match(/^\[\[\.\.\.([^\]]+)\]\]$/);
  if (optionalCatch) return `{${optionalCatch[1]}}`;
  const catchAll = seg.match(/^\[\.\.\.([^\]]+)\]$/);
  if (catchAll) return `{${catchAll[1]}}`;
  const dyn = seg.match(/^\[([^\]]+)\]$/);
  if (dyn) return `{${dyn[1]}}`;
  return seg;
}

function mapApiSegments(inner: string): string {
  const mapped: string[] = [];
  for (const seg of inner.split("/").filter(Boolean)) {
    const next = nextSegmentToOpenApi(seg);
    if (next === null) continue;
    mapped.push(next);
  }
  let path = normalizePath(`/api/${mapped.join("/")}`);
  if (path.endsWith("/index") && path !== "/index") {
    path = path.slice(0, -"/index".length) || "/";
  }
  return path;
}

export function nextApiPathFromRel(rel: string): string | null {
  const m = rel.match(/^(?:src\/)?app\/api\/(.*)\/route\.(t|j)sx?$/);
  if (!m) return null;
  return mapApiSegments(m[1]);
}

/** pages/api/users/[id].ts → /api/users/{id} */
export function pagesApiPathFromRel(rel: string): string | null {
  const m = rel.match(/^(?:src\/)?pages\/api\/(.+)\.(t|j)sx?$/);
  if (!m) return null;
  return mapApiSegments(m[1]);
}

function exportedHttpMethods(src: string): string[] {
  const found: string[] = [];
  for (const method of HTTP_METHODS) {
    const re = new RegExp(
      `export\\s+(?:async\\s+)?function\\s+${method}\\b|export\\s+const\\s+${method}\\s*=`,
    );
    if (re.test(src)) found.push(method);
  }
  if (found.length) return found;
  return ["GET"];
}

/** Next.js App Router: app/api/users/[id]/route.ts → /api/users/{id} */
export function nextAppApiRoutes(root: string): Route[] {
  const routes: Route[] = [];
  const files: string[] = [];
  walk(root, files);
  for (const full of files) {
    const rel = relative(root, full).replaceAll("\\", "/");
    const path = nextApiPathFromRel(rel);
    if (!path) continue;
    const src = readFileSync(full, "utf8");
    for (const method of exportedHttpMethods(src)) {
      routes.push({ method, path });
    }
  }
  return routes;
}

/**
 * Next.js pages/api: named GET/POST/… exports, else GET
 * (including `export default` with no named methods).
 */
export function nextPagesApiRoutes(root: string): Route[] {
  const routes: Route[] = [];
  const files: string[] = [];
  walk(root, files);
  for (const full of files) {
    const rel = relative(root, full).replaceAll("\\", "/");
    const path = pagesApiPathFromRel(rel);
    if (!path) continue;
    const src = readFileSync(full, "utf8");
    for (const method of exportedHttpMethods(src)) {
      routes.push({ method, path });
    }
  }
  return routes;
}

export function expressRoutes(root: string): Route[] {
  const routes: Route[] = [];
  const files: string[] = [];
  walk(root, files);
  const re =
    /\b(?:app|router)\.(get|post|put|patch|delete|options|head)\(\s*([`'"])(\/[^`'"]*)\2/gi;
  for (const full of files) {
    if (!/\.(t|j)sx?$/.test(full)) continue;
    const src = readFileSync(full, "utf8");
    let match: RegExpExecArray | null;
    const local = new RegExp(re.source, re.flags);
    while ((match = local.exec(src))) {
      routes.push({
        method: match[1].toUpperCase(),
        path: normalizePath(match[3]),
      });
    }
  }
  return routes;
}

export function readmeApiMentions(root: string): { path: string; line: number }[] {
  const readme = ["README.md", "readme.md"]
    .map((n) => join(root, n))
    .find((p) => existsSync(p));
  if (!readme) return [];
  const src = readFileSync(readme, "utf8");
  const seen = new Set<string>();
  const out: { path: string; line: number }[] = [];
  const re = /(?<![A-Za-z0-9])(\/api\/[A-Za-z0-9._~!$&'()*+,;=:@{}\-\/]*)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(src))) {
    const path = normalizePath(match[1].replace(/[.,)]+$/, ""));
    if (seen.has(path)) continue;
    seen.add(path);
    const line = src.slice(0, match.index).split(/\r?\n/).length;
    out.push({ path, line });
  }
  return out;
}

export type OpenApiParse =
  | { status: "missing" }
  | { status: "invalid"; file: string }
  | { status: "ok"; file: string; routes: Route[] };

function lineOfJsonPath(raw: string, path: string): number | undefined {
  const needle = `"${path}"`;
  const lines = raw.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(needle)) return i + 1;
  }
  return undefined;
}

function routesFromJsonSpec(raw: string): Route[] {
  const doc: unknown = JSON.parse(raw);
  if (doc === null || typeof doc !== "object" || Array.isArray(doc)) return [];
  const paths = (doc as { paths?: unknown }).paths;
  if (paths === null || typeof paths !== "object" || Array.isArray(paths)) {
    return [];
  }
  const routes: Route[] = [];
  for (const [path, ops] of Object.entries(paths as Record<string, unknown>)) {
    if (ops === null || typeof ops !== "object" || Array.isArray(ops)) continue;
    const line = lineOfJsonPath(raw, path);
    for (const method of Object.keys(ops as Record<string, unknown>)) {
      const m = method.toUpperCase();
      if ((HTTP_METHODS as readonly string[]).includes(m)) {
        routes.push({ method: m, path: normalizePath(path), ...(line ? { line } : {}) });
      }
    }
  }
  return routes;
}

function routesFromYamlSpec(raw: string): Route[] {
  const lineCounter = new LineCounter();
  const doc = parseDocument(raw, { lineCounter });
  if (doc.errors.length) {
    throw doc.errors[0];
  }
  const pathsNode = doc.get("paths", true);
  if (!isMap(pathsNode)) return [];
  const routes: Route[] = [];
  for (const item of pathsNode.items) {
    const path = isScalar(item.key) ? String(item.key.value) : "";
    let line: number | undefined;
    const range = item.key && "range" in item.key ? item.key.range : undefined;
    if (range) {
      const pos = lineCounter.linePos(range[0]);
      if (pos.line > 0) line = pos.line;
    }
    const ops = item.value;
    if (!isMap(ops)) continue;
    for (const op of ops.items) {
      const method = isScalar(op.key) ? String(op.key.value).toUpperCase() : "";
      if ((HTTP_METHODS as readonly string[]).includes(method)) {
        routes.push({
          method,
          path: normalizePath(path),
          ...(line !== undefined ? { line } : {}),
        });
      }
    }
  }
  return routes;
}

export function parseOpenApi(root: string): OpenApiParse {
  const specFile = ["openapi.yaml", "openapi.yml", "openapi.json"].find((n) =>
    existsSync(join(root, n)),
  );
  if (!specFile) return { status: "missing" };
  const raw = readFileSync(join(root, specFile), "utf8");
  try {
    const routes = specFile.endsWith(".json")
      ? routesFromJsonSpec(raw)
      : routesFromYamlSpec(raw);
    return { status: "ok", file: specFile, routes };
  } catch {
    return { status: "invalid", file: specFile };
  }
}

function key(r: Route): string {
  return `${r.method} ${r.path}`;
}

export const routesCheck: Check = {
  name: "routes",
  async run({ root, ignoreRoutes }) {
    const findings: Finding[] = [];
    const codeRoutes = [
      ...nextAppApiRoutes(root),
      ...nextPagesApiRoutes(root),
      ...expressRoutes(root),
      ...springJavaRoutes(root),
    ];
    const codeSet = new Set(codeRoutes.map(key));
    const codePaths = new Set(codeRoutes.map((r) => r.path));

    const spec = parseOpenApi(root);
    if (spec.status === "invalid") {
      findings.push({
        check: "routes",
        severity: "error",
        code: "ROUTE_NO_SPEC",
        file: spec.file,
        message: "invalid spec",
      });
    } else if (spec.status === "ok") {
      const specSet = new Set(spec.routes.map(key));
      for (const r of spec.routes) {
        if (routeIsIgnored(r.method, r.path, ignoreRoutes)) continue;
        if (!codeSet.has(key(r))) {
          findings.push({
            check: "routes",
            severity: "error",
            code: "ROUTE_SPEC_ORPHAN",
            file: spec.file,
            ...(r.line !== undefined ? { line: r.line } : {}),
            message: `${r.method} ${r.path} is in the OpenAPI spec but no matching handler was found in code.`,
          });
        }
      }
      for (const r of codeRoutes) {
        if (routeIsIgnored(r.method, r.path, ignoreRoutes)) continue;
        if (!specSet.has(key(r))) {
          findings.push({
            check: "routes",
            severity: "error",
            code: "ROUTE_CODE_MISSING_FROM_SPEC",
            file: spec.file,
            message: `${r.method} ${r.path} exists in code but is missing from the OpenAPI spec.`,
          });
        }
      }
    } else {
      findings.push({
        check: "routes",
        severity: "info",
        code: "ROUTE_NO_SPEC",
        file: "openapi.yaml",
        message: "No OpenAPI spec found. Route-vs-spec diff skipped.",
      });
    }

    const mentioned = readmeApiMentions(root);
    if (mentioned.length && existsSync(join(root, "README.md"))) {
      for (const m of mentioned) {
        if (ignoreRoutes.some((entry) => entry.trim().endsWith(m.path))) continue;
        if (!codePaths.has(m.path)) {
          findings.push({
            check: "routes",
            severity: "error",
            code: "ROUTE_README_ORPHAN",
            file: "README.md",
            line: m.line,
            message: `README mentions ${m.path} but no handler for that path was found.`,
          });
        }
      }
    }

    return findings;
  },
};
