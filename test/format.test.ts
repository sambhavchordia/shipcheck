import assert from "node:assert/strict";
import { test } from "node:test";
import { formatGithub, formatGithubFinding, resolveFormat } from "../src/format.js";
import type { Finding, Report } from "../src/types.js";

const finding: Finding = {
  check: "routes",
  severity: "error",
  code: "ROUTE_SPEC_ORPHAN",
  file: "openapi.yaml",
  line: 14,
  message: "GET /api/missing is in the OpenAPI spec but no matching handler was found in code.",
};

test("github format line contains ::error file=", () => {
  const line = formatGithubFinding(finding);
  assert.ok(line.includes("::error file="));
  assert.equal(
    line,
    "::error file=openapi.yaml,line=14::[ROUTE_SPEC_ORPHAN] GET /api/missing is in the OpenAPI spec but no matching handler was found in code.",
  );
});

test("--json is an alias for --format json; --format wins", () => {
  assert.equal(resolveFormat(["node", "cli", "--json"]), "json");
  assert.equal(resolveFormat(["node", "cli", "--format", "github"]), "github");
  assert.equal(resolveFormat(["node", "cli", "--json", "--format", "github"]), "github");
  assert.equal(resolveFormat(["node", "cli"]), "text");
});

test("formatGithub joins findings", () => {
  const report: Report = {
    version: 1,
    ok: false,
    root: "/x",
    counts: { error: 1, warn: 0, info: 0 },
    findings: [finding],
  };
  assert.ok(formatGithub(report).includes("::error file=openapi.yaml"));
});
