import type { Finding, Report } from "./types.js";

export type OutputFormat = "text" | "json" | "github";

export function resolveFormat(argv: string[] = process.argv): OutputFormat {
  const i = argv.indexOf("--format");
  if (i >= 0 && argv[i + 1]) {
    const v = argv[i + 1];
    if (v === "text" || v === "json" || v === "github") return v;
  }
  if (argv.includes("--json")) return "json";
  return "text";
}

export function formatText(report: Report): string {
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
    const loc = f.line !== undefined ? `${f.file}:${f.line}` : f.file;
    lines.push(`${tag}  ${loc}`);
    lines.push(`      [${f.check}] [${f.code}] ${f.message}`);
    lines.push("");
  }
  lines.push(
    `${report.counts.error} error(s), ${report.counts.warn} warning(s), ${report.findings.length} finding(s)`,
  );
  return lines.join("\n");
}

export function escapeGithub(message: string): string {
  return message
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
}

export function formatGithubFinding(f: Finding): string {
  const kind =
    f.severity === "error" ? "error" : f.severity === "warn" ? "warning" : "notice";
  const line = f.line !== undefined ? `,line=${f.line}` : "";
  return `::${kind} file=${f.file}${line}::[${f.code}] ${escapeGithub(f.message)}`;
}

export function formatGithub(report: Report): string {
  return report.findings.map(formatGithubFinding).join("\n");
}
