import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

type Route = { method: string; path: string; line?: number };

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "target",
  ".idea",
  ".next",
  "coverage",
  "fixtures",
]);

const SHORTCUTS: { name: string; method: string }[] = [
  { name: "GetMapping", method: "GET" },
  { name: "PostMapping", method: "POST" },
  { name: "PutMapping", method: "PUT" },
  { name: "PatchMapping", method: "PATCH" },
  { name: "DeleteMapping", method: "DELETE" },
];

function walkJava(dir: string, files: string[]) {
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
    if (st.isDirectory()) walkJava(full, files);
    else if (name.endsWith(".java")) files.push(full);
  }
}

export function normalizeSpringPath(p: string): string {
  let out = p.trim();
  if (!out.startsWith("/")) out = `/${out}`;
  if (out.length > 1 && out.endsWith("/")) out = out.slice(0, -1);
  return out;
}

/** "/api" + "/users" → /api/users; "/api" + "" → /api; "" + "/api/users" → /api/users */
export function joinSpringPaths(classPath: string, methodPath: string): string {
  const c = classPath.trim();
  const m = methodPath.trim();
  if (!c && !m) return "/";
  if (!m) return normalizeSpringPath(c);
  if (!c) return normalizeSpringPath(m);
  const left = c.replace(/\/+$/, "");
  const right = m.replace(/^\/+/, "");
  return normalizeSpringPath(`${left}/${right}`);
}

export function annotationPath(args: string | undefined): string | null {
  if (args === undefined || args.trim() === "") return "";
  const named = args.match(/\b(?:path|value)\s*=\s*"([^"]*)"/);
  if (named) return named[1];
  if (/\b(?:path|value)\s*=/.test(args)) return null;
  const bare = args.match(/^\s*"([^"]*)"/);
  if (bare) return bare[1];
  return "";
}

export function requestMethodsFromArgs(args: string | undefined): string[] {
  if (!args) return [];
  const found: string[] = [];
  const re = /RequestMethod\.(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(args))) {
    found.push(match[1]);
  }
  return found;
}

function annotationArgs(
  src: string,
  atIndex: number,
  nameLen: number,
): { args: string | undefined; end: number } {
  let i = atIndex + 1 + nameLen;
  while (i < src.length && /\s/.test(src[i])) i += 1;
  if (src[i] !== "(") return { args: undefined, end: i };
  let depth = 0;
  const start = i + 1;
  for (; i < src.length; i += 1) {
    if (src[i] === "(") depth += 1;
    else if (src[i] === ")") {
      depth -= 1;
      if (depth === 0) return { args: src.slice(start, i), end: i + 1 };
    }
  }
  return { args: src.slice(start), end: src.length };
}

function findAnnotations(src: string, name: string): { args: string | undefined }[] {
  const out: { args: string | undefined }[] = [];
  const token = `@${name}`;
  let from = 0;
  while (from < src.length) {
    const idx = src.indexOf(token, from);
    if (idx < 0) break;
    const after = src[idx + token.length];
    if (after && /[A-Za-z0-9_]/.test(after)) {
      from = idx + token.length;
      continue;
    }
    const parsed = annotationArgs(src, idx, name.length);
    out.push({ args: parsed.args });
    from = parsed.end;
  }
  return out;
}

function isSpringController(src: string): boolean {
  const withoutAdvice = src.replace(/@RestControllerAdvice\b/g, "");
  return /@RestController\b/.test(withoutAdvice) || /@Controller\b/.test(withoutAdvice);
}

export function springRoutesFromJava(src: string): Route[] {
  if (!isSpringController(src)) return [];
  const classMaps = findAnnotations(src, "RequestMapping");
  const classAnn = classMaps[0];
  const classPath = annotationPath(classAnn?.args) ?? "";
  if (classAnn && annotationPath(classAnn.args) === null) {
    return [];
  }
  const classMethods = requestMethodsFromArgs(classAnn?.args);
  const routes: Route[] = [];
  const seen = new Set<string>();

  function emit(method: string, path: string) {
    const key = `${method} ${path}`;
    if (seen.has(key)) return;
    seen.add(key);
    routes.push({ method, path });
  }

  for (const { name, method } of SHORTCUTS) {
    for (const ann of findAnnotations(src, name)) {
      const p = annotationPath(ann.args);
      if (p === null) continue;
      emit(method, joinSpringPaths(classPath, p));
    }
  }

  for (const ann of classMaps.slice(1)) {
    const p = annotationPath(ann.args);
    if (p === null) continue;
    const methods = requestMethodsFromArgs(ann.args);
    const list = methods.length ? methods : classMethods.length ? classMethods : ["GET"];
    const path = joinSpringPaths(classPath, p);
    for (const method of list) emit(method, path);
  }

  return routes;
}

export function springJavaRoutes(root: string): Route[] {
  const files: string[] = [];
  walkJava(root, files);
  const routes: Route[] = [];
  for (const full of files) {
    const src = readFileSync(full, "utf8");
    routes.push(...springRoutesFromJava(src));
  }
  return routes;
}
