import { envCheck } from "./checks/env.js";
import { secretsCheck } from "./checks/secrets.js";
import { routesCheck } from "./checks/routes.js";
import { loadConfig, type ShipcheckConfig } from "./config.js";
import type { Finding, Report } from "./types.js";

export async function runShipcheck(
  root: string,
  config?: ShipcheckConfig,
): Promise<Report> {
  const cfg = config ?? loadConfig(root);
  const checks = [envCheck, secretsCheck, routesCheck];
  const findings: Finding[] = [];
  for (const check of checks) {
    findings.push(...(await check.run({ root, ignorePaths: cfg.ignorePaths })));
  }
  return {
    root,
    findings,
    errors: findings.filter((f) => f.severity === "error").length,
    warnings: findings.filter((f) => f.severity === "warn").length,
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
    lines.push(`      [${f.check}] ${f.message}`);
    lines.push("");
  }
  lines.push(
    `${report.errors} error(s), ${report.warnings} warning(s), ${report.findings.length} finding(s)`,
  );
  return lines.join("\n");
}
