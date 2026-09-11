import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyBaseline,
  findingIsBaselined,
  parseBaseline,
} from "../src/baseline.js";
import type { Finding } from "../src/types.js";

const readme: Finding = {
  check: "routes",
  severity: "error",
  code: "ROUTE_README_ORPHAN",
  file: "README.md",
  message: "README mentions /api/health but no handler for that path was found.",
};

const secret: Finding = {
  check: "secrets",
  severity: "error",
  code: "SECRET_FILE",
  file: "keys/dev.pem",
  message: 'Secret-looking file suffix ".pem".',
};

test("baseline suppresses ROUTE_README_ORPHAN but not SECRET_FILE", () => {
  const baseline = parseBaseline({
    version: 1,
    ignore: [
      { code: "ROUTE_README_ORPHAN", file: "README.md" },
      { code: "SECRET_FILE", file: "keys/dev.pem" },
    ],
  });
  assert.equal(findingIsBaselined(readme, baseline), true);
  assert.equal(findingIsBaselined(secret, baseline), false);
  const left = applyBaseline([readme, secret], baseline);
  assert.deepEqual(
    left.map((f) => f.code),
    ["SECRET_FILE"],
  );
});
