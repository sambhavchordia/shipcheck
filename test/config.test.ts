import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  loadConfig,
  parseConfig,
  pathIsIgnored,
} from "../src/config.js";

test("parseConfig uses defaults for missing or invalid fields", () => {
  assert.deepEqual(parseConfig({}), { ignorePaths: [], failOn: "error" });
  assert.deepEqual(parseConfig(null), { ignorePaths: [], failOn: "error" });
  assert.deepEqual(parseConfig({ failOn: "nope", ignorePaths: "keys" }), {
    ignorePaths: [],
    failOn: "error",
  });
});

test("parseConfig accepts failOn and ignorePaths", () => {
  assert.deepEqual(
    parseConfig({ failOn: "warn", ignorePaths: ["keys", "tmp/dev.pem"] }),
    { failOn: "warn", ignorePaths: ["keys", "tmp/dev.pem"] },
  );
});

test("loadConfig returns defaults when the file is absent", () => {
  const dir = mkdtempSync(join(tmpdir(), "shipcheck-"));
  assert.deepEqual(loadConfig(dir), { ignorePaths: [], failOn: "error" });
});

test("loadConfig reads shipcheck.config.json from root", () => {
  const dir = mkdtempSync(join(tmpdir(), "shipcheck-"));
  writeFileSync(
    join(dir, "shipcheck.config.json"),
    JSON.stringify({ failOn: "warn", ignorePaths: ["keys"] }),
  );
  assert.deepEqual(loadConfig(dir), { failOn: "warn", ignorePaths: ["keys"] });
});

test("pathIsIgnored matches exact, prefix, and path segments", () => {
  assert.equal(pathIsIgnored("keys/dev.pem", ["keys"]), true);
  assert.equal(pathIsIgnored("keys", ["keys"]), true);
  assert.equal(pathIsIgnored("app/api/login/route.ts", ["keys"]), false);
  assert.equal(pathIsIgnored("tmp/dev.pem", ["tmp/dev.pem"]), true);
  assert.equal(pathIsIgnored("foo/keys/x.pem", ["keys"]), true);
});
