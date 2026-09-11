import assert from "node:assert/strict";
import { test } from "node:test";
import { isDummyValue } from "../src/checks/env.js";

test("isDummyValue matches known placeholders case-insensitively", () => {
  assert.equal(isDummyValue("changeme"), true);
  assert.equal(isDummyValue("Changeme"), true);
  assert.equal(isDummyValue("replace-me"), true);
});

test("isDummyValue rejects empty and non-placeholder values", () => {
  assert.equal(isDummyValue(""), false);
  assert.equal(isDummyValue("local-dev-only-not-a-real-prod-key"), false);
});
