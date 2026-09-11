import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runInit } from "../src/init.js";

test("init does not overwrite without --force", () => {
  const dir = mkdtempSync(join(tmpdir(), "shipcheck-init-"));
  writeFileSync(join(dir, ".env.example"), "KEEP=1\n");
  const first = runInit(dir, false);
  assert.ok(first.skipped.includes(".env.example"));
  assert.equal(readFileSync(join(dir, ".env.example"), "utf8"), "KEEP=1\n");
  assert.ok(first.created.includes("openapi.yaml"));
  const second = runInit(dir, false);
  assert.equal(second.created.length, 0);
  assert.equal(second.skipped.length, 3);
  const forced = runInit(dir, true);
  assert.ok(forced.created.includes(".env.example"));
  assert.equal(readFileSync(join(dir, ".env.example"), "utf8"), "DATABASE_URL=\n");
});
