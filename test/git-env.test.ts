import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldFlagEnvNotIgnored } from "../src/git-env.js";

test("shouldFlagEnvNotIgnored: tracked even if gitignored", () => {
  assert.equal(
    shouldFlagEnvNotIgnored({
      exists: true,
      gitignoredByFile: true,
      inWorkTree: true,
      tracked: true,
    }),
    true,
  );
});

test("shouldFlagEnvNotIgnored: untracked and not ignored", () => {
  assert.equal(
    shouldFlagEnvNotIgnored({
      exists: true,
      gitignoredByFile: false,
      inWorkTree: true,
      tracked: false,
    }),
    true,
  );
});

test("shouldFlagEnvNotIgnored: untracked and gitignored is ok", () => {
  assert.equal(
    shouldFlagEnvNotIgnored({
      exists: true,
      gitignoredByFile: true,
      inWorkTree: true,
      tracked: false,
    }),
    false,
  );
});

test("shouldFlagEnvNotIgnored: no git uses gitignore file only", () => {
  assert.equal(
    shouldFlagEnvNotIgnored({
      exists: true,
      gitignoredByFile: false,
      inWorkTree: false,
      tracked: false,
    }),
    true,
  );
  assert.equal(
    shouldFlagEnvNotIgnored({
      exists: true,
      gitignoredByFile: true,
      inWorkTree: false,
      tracked: false,
    }),
    false,
  );
  assert.equal(
    shouldFlagEnvNotIgnored({
      exists: false,
      gitignoredByFile: false,
      inWorkTree: false,
      tracked: false,
    }),
    false,
  );
});
