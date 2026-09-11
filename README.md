# shipcheck

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)
[![CI](https://img.shields.io/github/actions/workflow/status/sambhavchordia/shipcheck/shipcheck.yml?branch=main)](https://github.com/sambhavchordia/shipcheck/actions/workflows/shipcheck.yml)

Deterministic CI gate for env drift, dummy secrets, and OpenAPI/README routes that do not match the code. It compares files on disk, prints FAIL/WARN with stable finding codes, and exits 1. No LLM. Secret values are never printed.

## Demo

`npx tsx src/cli.ts --root fixtures/bad-app` (exit 1):

```
shipcheck  C:\Users\sambh\Desktop\shipcheck\fixtures\bad-app

FAIL  .env
      [env] [ENV_PLACEHOLDER] Key "JWT_SECRET" looks like a placeholder. Value not printed.

FAIL  .env
      [env] [ENV_MISSING_KEY] Missing key "AUTH_SECRET" that is listed in .env.example. Value not printed.

FAIL  .env
      [secrets] [SECRET_ENV_NOT_IGNORED] .env is present and not listed in .gitignore. Keep it local and commit .env.example only.

FAIL  keys/dev.pem
      [secrets] [SECRET_FILE] Secret-looking file suffix ".pem".

FAIL  openapi.yaml
      [routes] [ROUTE_SPEC_ORPHAN] GET /api/missing is in the OpenAPI spec but no matching handler was found in code.

FAIL  README.md
      [routes] [ROUTE_README_ORPHAN] README mentions /api/health but no handler for that path was found.

WARN  .env.example
      [env] [ENV_EXAMPLE_DUMMY] Key "JWT_SECRET" in the example file is a dummy value like changeme. Prefer KEY= with an empty value.

WARN  .env.example
      [env] [ENV_EXAMPLE_DUMMY] Key "AUTH_SECRET" in the example file is a dummy value like changeme. Prefer KEY= with an empty value.

6 error(s), 2 warning(s), 8 finding(s)
```

`npx tsx src/cli.ts --root fixtures/good-app` (exit 0):

```
shipcheck  C:\Users\sambh\Desktop\shipcheck\fixtures\good-app

PASS  no findings
```

`--json` prints a versioned report (`version: 1`). `ok` is `false` only when there is an **error** finding. `--fail-on warn` can still exit 1 when `ok` is `true`.

## Install / Run

Requires Node.js 20+. On Windows use `npx tsx` (not a bare `tsx`).

```bash
npm install
npx tsx src/cli.ts --root fixtures/bad-app
npx tsx src/cli.ts --root fixtures/good-app
npx tsx src/cli.ts --root fixtures/dynamic-app
npm test
```

```bash
npx tsx src/cli.ts --root . --json
npx tsx src/cli.ts --root fixtures/bad-app --fail-on warn
npx tsx src/cli.ts --help
```

`npm test` is `npx tsx --test test/env.test.ts test/routes.test.ts test/report.test.ts test/config.test.ts`.

CI (`.github/workflows/shipcheck.yml`) runs that on Node 20 and 22, asserts good-app and dynamic-app exit 0, and fails the job if bad-app exits 0 (`bad-app was expected to fail`).

## CLI flags

| Flag | Meaning |
|---|---|
| `--root DIR` | Project to scan (default: current directory) |
| `--json` | Print `{ version, ok, root, counts, findings }` |
| `--fail-on error\|warn` | Exit 1 at this severity. Default `error`, or `failOn` from config |
| `--help`, `-h` | Usage |

Exit `0` if nothing at or above the threshold, `1` if there are findings at or above it, `2` on unexpected failure (including invalid `shipcheck.config.json`). `info` findings never fail the process.

Precedence: CLI flags > `shipcheck.config.json` > defaults.

## Config

Optional `{root}/shipcheck.config.json` (`JSON.parse`). Missing file keeps defaults. Unknown keys are ignored.

```json
{
  "failOn": "error",
  "ignorePaths": ["keys"],
  "ignoreRoutes": ["GET /api/health"],
  "envExample": ".env.example"
}
```

| Field | Type | Default | Meaning |
|---|---|---|---|
| `failOn` | `"error"` \| `"warn"` | `"error"` | Exit threshold when `--fail-on` is omitted |
| `ignorePaths` | `string[]` | `[]` | Skip **secret** files whose relative path equals an entry or is under `entry/` |
| `ignoreRoutes` | `string[]` | `[]` | Skip route findings whose `METHOD /path` matches (method case-insensitive) |
| `envExample` | `string` | first existing `.env.example` or `.env.sample` | Example env file to compare |

## Checks and codes

Evaluate order: load config → **env** → **secrets** → **routes** → print (error, then warn, then info) → exit.

| Check | Code | Severity | When |
|---|---|---|---|
| env | `ENV_MISSING_EXAMPLE` | warn | No example file |
| env | `ENV_MISSING_KEY` | error / warn | Example key missing from `.env` (error), or no `.env` file (warn). Values not printed. |
| env | `ENV_PLACEHOLDER` | error | `.env` value empty or dummy (`changeme`, `replace-me`, …) |
| env | `ENV_EXAMPLE_DUMMY` | warn | Example value is dummy (empty example is OK) |
| secrets | `SECRET_ENV_NOT_IGNORED` | error | `.env` present and not gitignored (`.env` / `/.env` / `*.env`) |
| secrets | `SECRET_FILE` | error | `id_rsa` (and similar) or suffix `.pem` / `.p12` / `.pfx` / `.key` |
| routes | `ROUTE_SPEC_ORPHAN` | error | OpenAPI method+path has no handler |
| routes | `ROUTE_CODE_MISSING_FROM_SPEC` | error | Handler has no OpenAPI method+path |
| routes | `ROUTE_README_ORPHAN` | error | README `/api/...` has no handler |
| routes | `ROUTE_NO_SPEC` | info / error | No spec (info) or invalid YAML/JSON (`invalid spec`, error; diff skipped) |

Next App Router mapping: `app/api/users/[id]/route.ts` → `/api/users/{id}`. Catch-all `app/api/shop/[...slug]/route.ts` → `/api/shop/{slug}` (single `{param}`, not `{slug*}`). Route groups `(group)` are omitted. `src/app/api` is supported. No exported method → GET.

OpenAPI is parsed with the `yaml` package (YAML) or `JSON.parse` (JSON).

## Not this tool

| Tool | What it covers that shipcheck does not |
|---|---|
| Gitleaks / TruffleHog | Git history and entropy-based secret scanning |
| Spectral | OpenAPI style and schema lint |
| Dredd | Hitting a live server against the spec |

Those can sit next to shipcheck.

## Limits

- Next.js App Router plus a naive Express `app\|router.(get\|post\|…)` regex only (no Fastify / Nest / Remix)
- Catch-all folders map to one `{param}` as above
- README `/api/...` extraction has false positives
- Secret check is filename and suffix only — not history, not entropy, not file contents

## Project layout

```
src/cli.ts
src/run.ts
src/config.ts
src/types.ts
src/checks/env.ts
src/checks/secrets.ts
src/checks/routes.ts
test/
fixtures/bad-app           must fail (exit 1)
fixtures/good-app          must pass (exit 0)
fixtures/dynamic-app       [id] → {id}, must pass (exit 0)
.github/workflows/shipcheck.yml
LICENSE                    MIT
```

## Resume one-liner

shipcheck — TypeScript CLI that fails CI on env/secret drift and OpenAPI–code route mismatch.

## License

MIT. See [LICENSE](LICENSE).
