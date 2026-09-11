import { envCheck } from "./checks/env.js";
import { secretsCheck } from "./checks/secrets.js";
import { routesCheck } from "./checks/routes.js";
import { applyBaseline, loadBaseline, writeBaseline } from "./baseline.js";
import { loadConfig, type ShipcheckConfig } from "./config.js";
import type { Report } from "./types.js";

export type RunOptions = {
  writeBaseline?: boolean;
};

export async function runShipcheck(
  root: string,
  config?: ShipcheckConfig,
  options: RunOptions = {},
): Promise<Report> {
  const cfg = config ?? loadConfig(root);
  const checks = [envCheck, secretsCheck, routesCheck];
  const gathered = [];
  for (const check of checks) {
    gathered.push(
      ...(await check.run({
        root,
        ignorePaths: cfg.ignorePaths,
        ignoreRoutes: cfg.ignoreRoutes,
        envExample: cfg.envExample,
      })),
    );
  }
  if (options.writeBaseline) {
    writeBaseline(root, gathered);
  }
  const baseline = loadBaseline(root);
  const findings = applyBaseline(gathered, baseline);
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
