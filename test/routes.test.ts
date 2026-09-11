import assert from "node:assert/strict";
import { test } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { nextAppApiRoutes, openApiRoutes, type Route } from "../src/checks/routes.js";

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

test("openApiRoutes parses YAML paths for good-app and bad-app", () => {
  const good = openApiRoutes(join(fixtures, "good-app"));
  const bad = openApiRoutes(join(fixtures, "bad-app"));
  assert.ok(good);
  assert.ok(bad);
  assert.deepEqual(keys(good), new Set(["POST /api/login", "GET /api/health"]));
  assert.deepEqual(keys(bad), new Set(["POST /api/login", "GET /api/missing"]));
});
