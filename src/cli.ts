#!/usr/bin/env node
import { resolve } from "node:path";
import { loadConfig, type FailOn } from "./config.js";
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

Options:
  --root DIR           Project to scan (default: cwd)
  --json               Print versioned JSON report
  --fail-on error|warn Exit 1 at this severity (default: error, or shipcheck.config.json)
  --help, -h           Show this help

Config:
  Optional shipcheck.config.json in --root:
    { "failOn": "error", "ignorePaths": ["keys"], "ignoreRoutes": ["GET /api/health"], "envExample": ".env.example" }
  CLI --fail-on overrides failOn from the config file.
  --json "ok" is false only when there is an error finding; --fail-on warn can still exit 1 on warnings.

Exit codes:
  0  no errors (and no warnings if --fail-on warn)
  1  findings at or above the fail threshold
  2  unexpected failure
`);
    process.exit(0);
  }

  const root = resolve(arg("--root", process.cwd())!);
  const config = loadConfig(root);
  const cliFailOn = arg("--fail-on");
  const failOn: FailOn =
    cliFailOn === "warn" || cliFailOn === "error" ? cliFailOn : config.failOn;
  const json = has("--json");

  const report = await runShipcheck(root, config);
  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatReport(report));
  }

  const failed =
    failOn === "warn"
      ? report.counts.error + report.counts.warn > 0
      : report.counts.error > 0;
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(2);
});
