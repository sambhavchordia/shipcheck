import { envCheck } from "./checks/env.js";
import { secretsCheck } from "./checks/secrets.js";
import { routesCheck } from "./checks/routes.js";
import { loadConfig, type ShipcheckConfig } from "./config.js";
import type { Report } from "./types.js";

export async function runShipcheck(
  root: string,
  config?: ShipcheckConfig,
): Promise<Report> {
  const cfg = config ?? loadConfig(root);
  const checks = [envCheck, secretsCheck, routesCheck];
  const findings = [];
  for (const check of checks) {
    findings.push(
      ...(await check.run({
        root,
        ignorePaths: cfg.ignorePaths,
        ignoreRoutes: cfg.ignoreRoutes,
        envExample: cfg.envExample,
      })),
    );
  }
  const error = findings.filter((f) => f.severity === "error").length;
  const warn = findings.filter((f) => f.severity === "warn").length;
  const info = findings.filter((f) => f.severity === "info").length;
  return {
    version: 1,
    ok: error === 0,
    root,
    counts: { error, warn, info },
    findings,
  };
}

export function formatReport(report: Report): string {
  const lines: string[] = [];
  lines.push(`shipcheck  ${report.root}`);
  lines.push("");
  if (report.findings.length === 0) {
    lines.push("PASS  no findings");
    return lines.join("\n");
  }
  const order = { error: 0, warn: 1, info: 2 };
  const sorted = [...report.findings].sort(
    (a, b) => order[a.severity] - order[b.severity],
  );
  for (const f of sorted) {
    const tag = f.severity === "error" ? "FAIL" : f.severity === "warn" ? "WARN" : "INFO";
    lines.push(`${tag}  ${f.file}`);
    lines.push(`      [${f.check}] [${f.code}] ${f.message}`);
    lines.push("");
  }
  lines.push(
    `${report.counts.error} error(s), ${report.counts.warn} warning(s), ${report.findings.length} finding(s)`,
  );
  return lines.join("\n");
}
