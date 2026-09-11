import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { runShipcheck } from "../src/run.js";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

test("JSON report version is 1 and findings have codes", async () => {
  const report = await runShipcheck(join(fixtures, "bad-app"));
  assert.equal(report.version, 1);
  assert.equal(report.ok, false);
  assert.ok(report.findings.length > 0);
  for (const f of report.findings) {
    assert.equal(typeof f.code, "string");
    assert.ok(f.code.length > 0);
  }
  const codes = new Set(report.findings.map((f) => f.code));
  assert.ok(codes.has("ENV_PLACEHOLDER") || codes.has("ENV_MISSING_KEY"));
  assert.ok(codes.has("SECRET_FILE") || codes.has("SECRET_ENV_NOT_IGNORED"));
  assert.ok(codes.has("ROUTE_SPEC_ORPHAN"));
  assert.ok(codes.has("ROUTE_README_ORPHAN"));
});

test("ignoreRoutes suppresses ROUTE_SPEC_ORPHAN for that method+path", async () => {
  const root = join(fixtures, "bad-app");
  const full = await runShipcheck(root);
  const suppressed = await runShipcheck(root, {
    failOn: "error",
    ignorePaths: [],
    ignoreRoutes: ["GET /api/missing"],
  });
  assert.ok(
    full.findings.some(
      (f) => f.code === "ROUTE_SPEC_ORPHAN" && f.message.includes("GET /api/missing"),
    ),
  );
  assert.equal(
    suppressed.findings.some(
      (f) => f.code === "ROUTE_SPEC_ORPHAN" && f.message.includes("GET /api/missing"),
    ),
    false,
  );
});
