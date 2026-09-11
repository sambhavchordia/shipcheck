import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  annotationPath,
  joinSpringPaths,
  requestMethodsFromArgs,
  springJavaRoutes,
  springRoutesFromJava,
} from "../src/checks/spring.js";
import { runShipcheck } from "../src/run.js";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

test("prefix join", () => {
  assert.equal(joinSpringPaths("/api", "/users"), "/api/users");
  assert.equal(joinSpringPaths("/api", "users"), "/api/users");
  assert.equal(joinSpringPaths("", "/api/users"), "/api/users");
  assert.equal(joinSpringPaths("/api", ""), "/api");
  assert.equal(joinSpringPaths("/api/microtasks", "/task/{taskId}"), "/api/microtasks/task/{taskId}");
});

test("{taskId} is preserved", () => {
  const src = `
@RestController
@RequestMapping("/api/microtasks")
class C {
  @GetMapping("/task/{taskId}")
  void x() {}
}
`;
  const routes = springRoutesFromJava(src);
  assert.deepEqual(
    routes.map((r) => `${r.method} ${r.path}`),
    ["GET /api/microtasks/task/{taskId}"],
  );
});

test("RequestMethod array emits two methods", () => {
  const src = `
@RestController
@RequestMapping("/api")
class C {
  @RequestMapping(method = { RequestMethod.GET, RequestMethod.POST }, path = "/health")
  void x() {}
}
`;
  const keys = new Set(springRoutesFromJava(src).map((r) => `${r.method} ${r.path}`));
  assert.ok(keys.has("GET /api/health"));
  assert.ok(keys.has("POST /api/health"));
  assert.deepEqual(requestMethodsFromArgs("method = { RequestMethod.GET, RequestMethod.POST }"), [
    "GET",
    "POST",
  ]);
  assert.equal(annotationPath('path = "/x"'), "/x");
});

test("empty GetMapping uses class prefix", () => {
  const src = `
@RestController
@RequestMapping("/api/users")
class C {
  @GetMapping
  void list() {}
  @PostMapping
  void create() {}
}
`;
  const keys = new Set(springRoutesFromJava(src).map((r) => `${r.method} ${r.path}`));
  assert.ok(keys.has("GET /api/users"));
  assert.ok(keys.has("POST /api/users"));
});

test("spring-good has 0 errors", async () => {
  const report = await runShipcheck(join(fixtures, "spring-good"));
  assert.equal(report.counts.error, 0);
  const found = new Set(
    springJavaRoutes(join(fixtures, "spring-good")).map((r) => `${r.method} ${r.path}`),
  );
  assert.ok(found.has("GET /api/users"));
  assert.ok(found.has("POST /api/users"));
  assert.ok(found.has("GET /api/microtasks/task/{taskId}"));
});

test("spring-bad has ROUTE_SPEC_ORPHAN GET /api/missing", async () => {
  const report = await runShipcheck(join(fixtures, "spring-bad"));
  assert.ok(report.counts.error > 0);
  assert.ok(
    report.findings.some(
      (f) => f.code === "ROUTE_SPEC_ORPHAN" && f.message.includes("GET /api/missing"),
    ),
  );
});
