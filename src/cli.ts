#!/usr/bin/env node
import { resolve } from "node:path";
import { formatReport, runShipcheck } from "./run.js";

function arg(flag: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

function has(flag: string): boolean {
  return process.argv.includes(flag);
}

async function main() {
  if (has("--help") || has("-h")) {
    console.log(`shipcheck — env, secrets, and route drift

Usage:
  npx tsx src/cli.ts [--root DIR] [--json] [--fail-on error|warn]

Exit codes:
  0  no errors (and no warnings if --fail-on warn)
  1  findings at or above the fail threshold
`);
    process.exit(0);
  }

  const root = resolve(arg("--root", process.cwd())!);
  const failOn = arg("--fail-on", "error");
  const json = has("--json");

  const report = await runShipcheck(root);
  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatReport(report));
  }

  const failed =
    failOn === "warn"
      ? report.errors + report.warnings > 0
      : report.errors > 0;
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(2);
});
