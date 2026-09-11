import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  nextApiPathFromRel,
  nextAppApiRoutes,
  nextPagesApiRoutes,
  pagesApiPathFromRel,
  parseOpenApi,
  type Route,
} from "../src/checks/routes.js";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

function keys(routes: Route[]): Set<string> {
  return new Set(routes.map((r) => `${r.method} ${r.path}`));
}

test("nextAppApiRoutes parses good-app App Router handlers", () => {
  const found = keys(nextAppApiRoutes(join(fixtures, "good-app")));
  assert.deepEqual(found, new Set(["POST /api/login", "GET /api/health"]));
});

test("nextAppApiRoutes parses bad-app App Router handlers", () => {
  const found = keys(nextAppApiRoutes(join(fixtures, "bad-app")));
  assert.deepEqual(found, new Set(["POST /api/login"]));
});

test("Next [id] maps to OpenAPI {id}", () => {
  assert.equal(
    nextApiPathFromRel("app/api/users/[id]/route.ts"),
    "/api/users/{id}",
  );
  assert.equal(
    nextApiPathFromRel("app/api/shop/[...slug]/route.ts"),
    "/api/shop/{slug}",
  );
  assert.equal(
    nextApiPathFromRel("app/api/(group)/login/route.ts"),
    "/api/login",
  );
  const found = keys(nextAppApiRoutes(join(fixtures, "dynamic-app")));
  assert.deepEqual(found, new Set(["GET /api/users/{id}"]));
});

test("pages/api [id] maps to OpenAPI {id}", () => {
  assert.equal(
    pagesApiPathFromRel("pages/api/users/[id].ts"),
    "/api/users/{id}",
  );
  assert.equal(
    pagesApiPathFromRel("pages/api/shop/[...slug].ts"),
    "/api/shop/{slug}",
  );
  const found = keys(nextPagesApiRoutes(join(fixtures, "pages-app")));
  assert.deepEqual(found, new Set(["GET /api/hello"]));
});

test("OpenAPI yaml parse includes GET /api/missing on bad-app", () => {
  const good = parseOpenApi(join(fixtures, "good-app"));
  const bad = parseOpenApi(join(fixtures, "bad-app"));
  assert.equal(good.status, "ok");
  assert.equal(bad.status, "ok");
  if (good.status !== "ok" || bad.status !== "ok") return;
  assert.deepEqual(keys(good.routes), new Set(["POST /api/login", "GET /api/health"]));
  assert.deepEqual(keys(bad.routes), new Set(["POST /api/login", "GET /api/missing"]));
});

test("empty OpenAPI get: {} is a real GET", () => {
  const dir = mkdtempSync(join(tmpdir(), "shipcheck-oa-"));
  writeFileSync(
    join(dir, "openapi.yaml"),
    `openapi: 3.0.3
info:
  title: t
  version: 0.0.1
paths:
  /api/missing-report:
    get: {}
`,
  );
  const parsed = parseOpenApi(dir);
  assert.equal(parsed.status, "ok");
  if (parsed.status !== "ok") return;
  assert.ok(keys(parsed.routes).has("GET /api/missing-report"));
});
