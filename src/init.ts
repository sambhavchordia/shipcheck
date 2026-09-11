import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ENV_EXAMPLE = "DATABASE_URL=\n";

const OPENAPI = `openapi: 3.0.3
info:
  title: API
  version: 0.0.1
paths: {}
`;

const CONFIG = `${JSON.stringify(
  { failOn: "error", ignorePaths: [], ignoreRoutes: [] },
  null,
  2,
)}\n`;

export type InitResult = {
  created: string[];
  skipped: string[];
};

export function runInit(root: string, force: boolean): InitResult {
  mkdirSync(root, { recursive: true });
  const files: { rel: string; body: string }[] = [
    { rel: ".env.example", body: ENV_EXAMPLE },
    { rel: "openapi.yaml", body: OPENAPI },
    { rel: "shipcheck.config.json", body: CONFIG },
  ];
  const created: string[] = [];
  const skipped: string[] = [];
  for (const f of files) {
    const full = join(root, f.rel);
    if (existsSync(full) && !force) {
      skipped.push(f.rel);
      continue;
    }
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, f.body);
    created.push(f.rel);
  }
  return { created, skipped };
}
