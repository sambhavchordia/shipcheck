#!/usr/bin/env node
import { resolve } from "node:path";
import { loadConfig, type FailOn } from "./config.js";
import { formatGithub, formatText, resolveFormat } from "./format.js";
import { runInit } from "./init.js";
import { runShipcheck } from "./run.js";

function arg(flag: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

function has(flag: string): boolean {
  return process.argv.includes(flag);
}

const VALUE_FLAGS = new Set(["--root", "--fail-on", "--format"]);

function positionals(): string[] {
  const argv = process.argv.slice(2);
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (VALUE_FLAGS.has(argv[i])) {
      i += 1;
      continue;
    }
    if (argv[i].startsWith("-")) continue;
    out.push(argv[i]);
  }
  return out;
}

async function main() {
  if (has("--help") || has("-h")) {
    console.log(`shipcheck — env, secrets, and route drift

Usage:
  npx tsx src/cli.ts [--root DIR] [--json] [--format text|json|github] [--fail-on error|warn] [--write-baseline]
  npx tsx src/cli.ts init [--root DIR] [--force]

Options:
  --root DIR                 Project to scan or init (default: cwd)
  --json                     Alias for --format json
  --format text|json|github  Output format (default: text). Not auto-selected in GitHub Actions.
  --fail-on error|warn       Exit 1 at this severity (default: error, or shipcheck.config.json)
  --write-baseline           Write error+warn findings to shipcheck.ok.json (not SECRET_*)
  --force                    With init: overwrite existing stub files
  --help, -h                 Show this help

Config:
  Optional shipcheck.config.json in --root.
  Optional shipcheck.ok.json baseline (cannot suppress SECRET_FILE or SECRET_ENV_NOT_IGNORED).
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

  if (positionals()[0] === "init") {
    const result = runInit(root, has("--force"));
    if (result.created.length === 0) {
      console.log("nothing changed");
    } else {
      for (const rel of result.created) {
        console.log(`created ${rel}`);
      }
    }
    process.exit(0);
  }

  const config = loadConfig(root);
  const cliFailOn = arg("--fail-on");
  const failOn: FailOn =
    cliFailOn === "warn" || cliFailOn === "error" ? cliFailOn : config.failOn;
  const format = resolveFormat();

  const report = await runShipcheck(root, config, {
    writeBaseline: has("--write-baseline"),
  });
  if (format === "json") {
    console.log(JSON.stringify(report, null, 2));
  } else if (format === "github") {
    const out = formatGithub(report);
    if (out) console.log(out);
  } else {
    console.log(formatText(report));
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
