export type Severity = "error" | "warn" | "info";

export type Finding = {
  check: string;
  severity: Severity;
  file: string;
  message: string;
};

export type CheckContext = {
  root: string;
  ignorePaths: string[];
};

export type Check = {
  name: string;
  run: (ctx: CheckContext) => Promise<Finding[]>;
};

export type Report = {
  root: string;
  findings: Finding[];
  errors: number;
  warnings: number;
};
