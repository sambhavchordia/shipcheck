import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { envCheck, isDummyValue } from "../src/checks/env.js";

test("isDummyValue matches known placeholders case-insensitively", () => {
  assert.equal(isDummyValue("changeme"), true);
  assert.equal(isDummyValue("Changeme"), true);
  assert.equal(isDummyValue("replace-me"), true);
});

test("isDummyValue rejects empty and non-placeholder values", () => {
  assert.equal(isDummyValue(""), false);
  assert.equal(isDummyValue("local-dev-only-not-a-real-prod-key"), false);
});

test("empty example is not dummy; empty .env value is ENV_PLACEHOLDER", async () => {
  const dir = mkdtempSync(join(tmpdir(), "shipcheck-env-"));
  writeFileSync(join(dir, ".env.example"), "TOKEN=\n");
  writeFileSync(join(dir, ".env"), "TOKEN=\n");
  const findings = await envCheck.run({
    root: dir,
    ignorePaths: [],
    ignoreRoutes: [],
  });
  assert.equal(
    findings.some((f) => f.code === "ENV_EXAMPLE_DUMMY"),
    false,
  );
  const placeholder = findings.filter((f) => f.code === "ENV_PLACEHOLDER");
  assert.equal(placeholder.length, 1);
  assert.equal(placeholder[0].severity, "error");
  assert.equal(placeholder[0].line, 1);
});

test("dotenv example is not compared to application.properties", async () => {
  const dir = mkdtempSync(join(tmpdir(), "shipcheck-env-spring-"));
  writeFileSync(join(dir, ".env.example"), "DB_URL=\n");
  mkdirSync(join(dir, "src", "main", "resources"), { recursive: true });
  writeFileSync(
    join(dir, "src", "main", "resources", "application.properties"),
    "spring.datasource.url=jdbc:example\n",
  );
  const findings = await envCheck.run({
    root: dir,
    ignorePaths: [],
    ignoreRoutes: [],
  });
  assert.equal(findings.some((f) => f.severity === "error"), false);
  const missing = findings.filter((f) => f.code === "ENV_MISSING_KEY");
  assert.equal(missing.length, 1);
  assert.equal(missing[0].severity, "warn");
  assert.equal(
    findings.some((f) => f.message.includes("spring.datasource.url")),
    false,
  );
});
