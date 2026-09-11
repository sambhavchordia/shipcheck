# shipcheck

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)
[![CI](https://img.shields.io/github/actions/workflow/status/sambhavchordia/shipcheck/shipcheck.yml?branch=main)](https://github.com/sambhavchordia/shipcheck/actions/workflows/shipcheck.yml)

Deterministic CI gate for env drift, dummy secrets, and OpenAPI/README routes that do not match the code. It compares files on disk, prints FAIL/WARN, and exits 1. No LLM. Secret values are never printed.

## Demo

`npx tsx src/cli.ts --root fixtures/bad-app` (exit 1):

```
shipcheck  C:\Users\sambh\Desktop\shipcheck\fixtures\bad-app

FAIL  .env
      [env] Key "JWT_SECRET" looks like a placeholder. Value not printed.

FAIL  .env
      [env] Missing key "AUTH_SECRET" that is listed in .env.example. Value not printed.

FAIL  .env
      [secrets] .env is present and not listed in .gitignore. Keep it local and commit .env.example only.

FAIL  keys/dev.pem
      [secrets] Secret-looking file suffix ".pem".

FAIL  openapi.yaml
      [routes] GET /api/missing is in the OpenAPI spec but no matching handler was found in code.

FAIL  README.md
      [routes] README mentions /api/health but no handler for that path was found.

WARN  .env.example
      [env] Key "JWT_SECRET" in the example file is a dummy value like changeme. Prefer KEY= with an empty value.

WARN  .env.example
      [env] Key "AUTH_SECRET" in the example file is a dummy value like changeme. Prefer KEY= with an empty value.

6 error(s), 2 warning(s), 8 finding(s)
```

`npx tsx src/cli.ts --root fixtures/good-app` (exit 0):

```
shipcheck  C:\Users\sambh\Desktop\shipcheck\fixtures\good-app

PASS  no findings
```

## Install / Run

Requires Node.js 20+. On Windows use `npx tsx` (not a bare `tsx`).

```bash
npm install
npx tsx src/cli.ts --root fixtures/bad-app
npx tsx src/cli.ts --root fixtures/good-app
npm test
```

```bash
npx tsx src/cli.ts --root . --json
npx tsx src/cli.ts --root fixtures/bad-app --fail-on warn
npx tsx src/cli.ts --help
```

`npm test` is `npx tsx --test test/env.test.ts test/routes.test.ts test/config.test.ts`.

CI (`.github/workflows/shipcheck.yml`) runs `npm test`, asserts bad-app exits 1, and asserts good-app exits 0.

## CLI flags

| Flag | Meaning |
|---|---|
| `--root DIR` | Project to scan (default: current directory) |
| `--json` | Print the report as JSON |
| `--fail-on error\|warn` | Exit 1 at this severity. Default `error`, or `failOn` from config |
| `--help`, `-h` | Usage |

Exit `0` if nothing at or above the threshold, `1` if there are findings at or above it, `2` on unexpected failure. `info` findings never fail the process.

`--fail-on` on the CLI overrides `failOn` in `shipcheck.config.json`.

## Checks

| Check | Error | Warn | Info |
|---|---|---|---|
| env | Key listed in `.env.example` or `.env.sample` is missing from `.env`, or the `.env` value is empty / a placeholder (`changeme`, `replace-me`, and similar). Values are never printed. | No example file; no `.env` (lists expected keys only); an example key is itself a dummy | — |
| secrets | `.env` is present and not gitignored (`.env`, `/.env`, or `*.env`); secret-looking names (`id_rsa`, …); suffixes `.pem` / `.p12` / `.pfx` / `.key` | — | — |
| routes | OpenAPI path+method has no matching Next `app/api/**/route.ts` or naive `app.get("/...")` handler (or the reverse); README mentions `/api/...` with no handler | — | No OpenAPI spec, so spec-vs-code diff is skipped |

## Evaluate order

1. Load optional `shipcheck.config.json` from `--root` (defaults if missing).
2. Run **env**, then **secrets**, then **routes**.
3. Print findings sorted error → warn → info.
4. Exit using `--fail-on` if set, else config `failOn`, else `error`.

## Config

Optional `{root}/shipcheck.config.json`. Missing file keeps defaults (`failOn: "error"`, `ignorePaths: []`). Parsed with `JSON.parse` (no extra YAML/JSON library).

```json
{
  "ignorePaths": ["keys", "tmp"],
  "failOn": "error"
}
```

| Field | Type | Default | Meaning |
|---|---|---|---|
| `ignorePaths` | `string[]` | `[]` | Skip matching files/dirs in the **secrets** and **routes** tree walks (exact path, prefix, or path segment). Does not skip the named `.env` / example / OpenAPI / README files. |
| `failOn` | `"error"` \| `"warn"` | `"error"` | Exit threshold when `--fail-on` is omitted |

Unknown keys are ignored. Invalid `failOn` or non-string `ignorePaths` fall back to defaults. Invalid JSON is an unexpected failure (exit 2).

## Not this tool

| Tool | What it covers that shipcheck does not |
|---|---|
| Gitleaks / TruffleHog | Git history and entropy-based secret scanning |
| Spectral | OpenAPI style and schema lint |
| Dredd | Hitting a live server against the spec |

Those can sit next to shipcheck.

## Limits

- Next.js App Router plus a naive Express `app|router.(get\|post\|…)` regex only
- OpenAPI YAML parser is indentation-based (`paths:` / `  /foo:` / `    get:`), not a full YAML library
- README `/api/...` extraction has false positives
- Secret check is filename and suffix only — not history, not entropy, not file contents

## Project layout

```
src/cli.ts                 CLI
src/run.ts                 env → secrets → routes, report format
src/config.ts              shipcheck.config.json
src/types.ts
src/checks/env.ts
src/checks/secrets.ts
src/checks/routes.ts
test/                      node:test via tsx
fixtures/bad-app           must fail
fixtures/good-app          must pass
.github/workflows/shipcheck.yml
LICENSE                    MIT
```

## Resume one-liner

shipcheck — TypeScript CLI that fails CI on env/secret drift and OpenAPI–code route mismatch.

## License

MIT. See [LICENSE](LICENSE).
