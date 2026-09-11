export type Severity = "error" | "warn" | "info";

export type CheckName = "env" | "secrets" | "routes";

export type FindingCode =
  | "ENV_MISSING_EXAMPLE"
  | "ENV_MISSING_KEY"
  | "ENV_PLACEHOLDER"
  | "ENV_EXAMPLE_DUMMY"
  | "SECRET_ENV_NOT_IGNORED"
  | "SECRET_FILE"
  | "ROUTE_SPEC_ORPHAN"
  | "ROUTE_CODE_MISSING_FROM_SPEC"
  | "ROUTE_README_ORPHAN"
  | "ROUTE_NO_SPEC";

export type Finding = {
  check: CheckName;
  severity: Severity;
  code: FindingCode;
  file: string;
  message: string;
};

export type CheckContext = {
  root: string;
  ignorePaths: string[];
  ignoreRoutes: string[];
  envExample?: string;
};

export type Check = {
  name: CheckName;
  run: (ctx: CheckContext) => Promise<Finding[]>;
};

export type Report = {
  version: 1;
  ok: boolean;
  root: string;
  counts: { error: number; warn: number; info: number };
  findings: Finding[];
};
