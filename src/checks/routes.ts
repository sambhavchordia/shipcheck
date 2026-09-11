import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { Check, Finding } from "../types.js";

export type Route = { method: string; path: string };

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  "fixtures",
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

function normalizePath(p: string): string {
  let out = p.trim();
  if (!out.startsWith("/")) out = `/${out}`;
  if (out.length > 1 && out.endsWith("/")) out = out.slice(0, -1);
  return out;
}

/** Next.js App Router: app/api/login/route.ts → /api/login */
export function nextAppApiRoutes(root: string): Route[] {
  const routes: Route[] = [];
  const files: string[] = [];
  walk(root, files);
  for (const full of files) {
    const rel = relative(root, full).replaceAll("\\", "/");
    const m = rel.match(/^(?:src\/)?app\/api\/(.*)\/route\.(t|j)sx?$/);
    if (!m) continue;
    const path = normalizePath(`/api/${m[1]}`.replaceAll(/\/index$/g, ""));
    const src = readFileSync(full, "utf8");
    const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];
    let any = false;
    for (const method of methods) {
      const re = new RegExp(
        `export\\s+(?:async\\s+)?function\\s+${method}\\b|export\\s+const\\s+${method}\\s*=`,
      );
      if (re.test(src)) {
        routes.push({ method, path });
        any = true;
      }
    }
    if (!any) routes.push({ method: "GET", path });
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

export function readmeApiMentions(root: string): string[] {
  const readme = ["README.md", "readme.md"]
    .map((n) => join(root, n))
    .find((p) => existsSync(p));
  if (!readme) return [];
  const src = readFileSync(readme, "utf8");
  const paths = new Set<string>();
  const re = /(?<![A-Za-z0-9])(\/api\/[A-Za-z0-9._~!$&'()*+,;=:@\-\/]*)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(src))) {
    paths.add(normalizePath(match[1].replace(/[.,)]+$/, "")));
  }
  return [...paths];
}

export function openApiRoutes(root: string): Route[] | null {
  const specPath = ["openapi.yaml", "openapi.yml", "openapi.json"]
    .map((n) => join(root, n))
    .find((p) => existsSync(p));
  if (!specPath) return null;

  const raw = readFileSync(specPath, "utf8");
  if (specPath.endsWith(".json")) {
    const json = JSON.parse(raw) as { paths?: Record<string, Record<string, unknown>> };
    const routes: Route[] = [];
    for (const [path, ops] of Object.entries(json.paths ?? {})) {
      for (const method of Object.keys(ops)) {
        const m = method.toUpperCase();
        if (["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"].includes(m)) {
          routes.push({ method: m, path: normalizePath(path) });
        }
      }
    }
    return routes;
  }

  // Minimal YAML paths: block under `paths:` then `  /foo:` then `    get:`
  const routes: Route[] = [];
  const lines = raw.split(/\r?\n/);
  let inPaths = false;
  let currentPath: string | null = null;
  for (const line of lines) {
    if (/^paths:\s*$/.test(line)) {
      inPaths = true;
      continue;
    }
    if (inPaths && /^\S/.test(line) && !line.startsWith(" ")) {
      break;
    }
    if (!inPaths) continue;
    const pathMatch = line.match(/^  (\/[^\s:]+):\s*$/);
    if (pathMatch) {
      currentPath = normalizePath(pathMatch[1]);
      continue;
    }
    const methodMatch = line.match(/^    (get|post|put|patch|delete|options|head):\s*$/i);
    if (methodMatch && currentPath) {
      routes.push({ method: methodMatch[1].toUpperCase(), path: currentPath });
    }
  }
  return routes;
}

function key(r: Route): string {
  return `${r.method} ${r.path}`;
}

export const routesCheck: Check = {
  name: "routes",
  async run({ root }) {
    const findings: Finding[] = [];
    const codeRoutes = [
      ...nextAppApiRoutes(root),
      ...expressRoutes(root),
    ];
    const codeSet = new Set(codeRoutes.map(key));
    const codePaths = new Set(codeRoutes.map((r) => r.path));

    const spec = openApiRoutes(root);
    if (spec) {
      const specFile = existsSync(join(root, "openapi.yaml"))
        ? "openapi.yaml"
        : existsSync(join(root, "openapi.yml"))
          ? "openapi.yml"
          : "openapi.json";
      const specSet = new Set(spec.map(key));
      for (const r of spec) {
        if (!codeSet.has(key(r))) {
          findings.push({
            check: "routes",
            severity: "error",
            file: specFile,
            message: `${r.method} ${r.path} is in the OpenAPI spec but no matching handler was found in code.`,
          });
        }
      }
      for (const r of codeRoutes) {
        if (!specSet.has(key(r))) {
          findings.push({
            check: "routes",
            severity: "error",
            file: specFile,
            message: `${r.method} ${r.path} exists in code but is missing from the OpenAPI spec.`,
          });
        }
      }
    } else {
      findings.push({
        check: "routes",
        severity: "info",
        file: "openapi.yaml",
        message: "No OpenAPI spec found. Route-vs-spec diff skipped.",
      });
    }

    const mentioned = readmeApiMentions(root);
    if (mentioned.length && existsSync(join(root, "README.md"))) {
      for (const p of mentioned) {
        if (!codePaths.has(p)) {
          findings.push({
            check: "routes",
            severity: "error",
            file: "README.md",
            message: `README mentions ${p} but no handler for that path was found.`,
          });
        }
      }
    }

    return findings;
  },
};
