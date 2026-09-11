# shipcheck

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)
[![CI](https://img.shields.io/github/actions/workflow/status/sambhavchordia/shipcheck/shipcheck.yml?branch=main)](https://github.com/sambhavchordia/shipcheck/actions/workflows/shipcheck.yml)

Deterministic CI gate for env drift, dummy secrets, and OpenAPI/README routes that do not match the code. It compares files on disk, prints FAIL/WARN with stable finding codes, and exits 1. No LLM. Secret values are never printed.

## Demo

`npx tsx src/cli.ts --root fixtures/bad-app` (exit 1):

```
shipcheck  C:\Users\sambh\Desktop\shipcheck\fixtures\bad-app

FAIL  .env:2
      [env] [ENV_PLACEHOLDER] Key "JWT_SECRET" looks like a placeholder. Value not printed.

FAIL  .env
      [env] [ENV_MISSING_KEY] Missing key "AUTH_SECRET" that is listed in .env.example. Value not printed.

FAIL  .env
      [secrets] [SECRET_ENV_NOT_IGNORED] .env is present and not listed in .gitignore. Keep it local and commit .env.example only.

FAIL  keys/dev.pem
      [secrets] [SECRET_FILE] Secret-looking file suffix ".pem".

FAIL  openapi.yaml:11
      [routes] [ROUTE_SPEC_ORPHAN] GET /api/missing is in the OpenAPI spec but no matching handler was found in code.

FAIL  README.md:4
      [routes] [ROUTE_README_ORPHAN] README mentions /api/health but no handler for that path was found.

WARN  .env.example:2
      [env] [ENV_EXAMPLE_DUMMY] Key "JWT_SECRET" in the example file is a dummy value like changeme. Prefer KEY= with an empty value.

WARN  .env.example:3
      [env] [ENV_EXAMPLE_DUMMY] Key "AUTH_SECRET" in the example file is a dummy value like changeme. Prefer KEY= with an empty value.

6 error(s), 2 warning(s), 8 finding(s)
```

`npx tsx src/cli.ts --root fixtures/good-app` (exit 0):

```
shipcheck  C:\Users\sambh\Desktop\shipcheck\fixtures\good-app

PASS  no findings
```

`--json` prints a versioned report (`version: 1`) with optional `line` on findings. `ok` is `false` only when there is an **error** finding. `--fail-on warn` can still exit 1 when `ok` is `true`.

## Install / Run

Requires Node.js 20+. On Windows use `npx tsx` (not a bare `tsx`).

```bash
npm install
npx tsx src/cli.ts --root fixtures/bad-app
npx tsx src/cli.ts --root fixtures/good-app
npx tsx src/cli.ts --root fixtures/dynamic-app
npx tsx src/cli.ts --root fixtures/pages-app
npx tsx src/cli.ts init --root .
npm test
```

```bash
npx tsx src/cli.ts --root . --json
npx tsx src/cli.ts --root fixtures/bad-app --format github
npx tsx src/cli.ts --root fixtures/bad-app --fail-on warn
npx tsx src/cli.ts --help
```

`GITHUB_ACTIONS=true` does **not** switch format. Pass `--format github` as an extra CI step if you want annotations.

## CLI flags

| Flag | Meaning |
|---|---|
| `--root DIR` | Project to scan or init (default: current directory) |
| `--json` | Alias for `--format json` |
| `--format text\|json\|github` | Output format (default `text`) |
| `--fail-on error\|warn` | Exit 1 at this severity. Default `error`, or `failOn` from config |
| `--write-baseline` | Write error+warn findings to `shipcheck.ok.json` (never `SECRET_*`) |
| `--force` | With `init`: overwrite stub files |
| `--help`, `-h` | Usage |

Exit `0` if nothing at or above the threshold, `1` if there are findings at or above it, `2` on unexpected failure (invalid config or baseline JSON). `info` findings never fail the process.

Precedence: CLI flags > `shipcheck.config.json` > defaults.

## init

`npx tsx src/cli.ts init [--root DIR] [--force]` creates, if missing:

- `.env.example` (`DATABASE_URL=`)
- `openapi.yaml` (OpenAPI 3 stub, `paths: {}`)
- `shipcheck.config.json` (`failOn: error`, empty ignore arrays)

Does not create `.env`. Does not overwrite without `--force`. If everything already exists: prints `nothing changed`, exit 0.

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

## Baseline

Optional `{root}/shipcheck.ok.json` for adopting a messy repo. It is **not** a way to hide a committed `.env`.

```json
{
  "version": 1,
  "ignore": [
    { "code": "ROUTE_README_ORPHAN", "file": "README.md" }
  ]
}
```

A finding is suppressed when `code` matches and `file` is omitted or equals `finding.file`. `SECRET_FILE` and `SECRET_ENV_NOT_IGNORED` are **never** suppressible. Invalid JSON → stderr, exit 2.

`--write-baseline` writes current error+warn findings (except those two secret codes).

## Checks and codes

Evaluate order: load config → **env** → **secrets** → **routes** → apply baseline → print → exit.

| Check | Code | Severity | When |
|---|---|---|---|
| env | `ENV_MISSING_EXAMPLE` | warn | No example file |
| env | `ENV_MISSING_KEY` | error / warn | Example key missing from `.env` (error), or no `.env` file (warn). Values not printed. |
| env | `ENV_PLACEHOLDER` | error | `.env` value empty or dummy (`changeme`, `replace-me`, …) |
| env | `ENV_EXAMPLE_DUMMY` | warn | Example value is dummy (empty example is OK) |
| secrets | `SECRET_ENV_NOT_IGNORED` | error | `.env` present and not listed in the target `.gitignore`, **or** `.env` is **tracked** (`git ls-files`) even if gitignored |
| secrets | `SECRET_FILE` | error | `id_rsa` (and similar) or suffix `.pem` / `.p12` / `.pfx` / `.key` |
| routes | `ROUTE_SPEC_ORPHAN` | error | OpenAPI method+path has no handler |
| routes | `ROUTE_CODE_MISSING_FROM_SPEC` | error | Handler has no OpenAPI method+path |
| routes | `ROUTE_README_ORPHAN` | error | README `/api/...` has no handler |
| routes | `ROUTE_NO_SPEC` | info / error | No spec (info) or invalid YAML/JSON (`invalid spec`, error; diff skipped) |

A **tracked** `.env` is an error even if `.gitignore` lists `.env`. If `git` is missing or `--root` is not a work tree, only the `.gitignore` file is used. No history scan, no file-content scan.

Next.js App Router: `app/api/users/[id]/route.ts` → `/api/users/{id}`. Pages Router: `pages/api/users/[id].ts` → `/api/users/{id}`. Catch-all `[...slug]` → `{slug}` (one `{param}`, not `{slug*}`). Route groups `(group)` omitted. `src/app/api` and `src/pages/api` work. Named `GET`/`POST`/… exports if present; otherwise **GET** (including `export default` with no named methods).

OpenAPI is parsed with the `yaml` package (YAML) or `JSON.parse` (JSON). Findings may include `line` (1-based) when it is cheap to know.

## GitHub annotations

`--format github` prints workflow commands (error / warning / notice). Example:

```
::error file=openapi.yaml,line=11::[ROUTE_SPEC_ORPHAN] GET /api/missing is in the OpenAPI spec but no matching handler was found in code.
```

Exit codes are unchanged. CI can add this as an extra step.

## Not this tool

| Tool | What it covers that shipcheck does not |
|---|---|
| Gitleaks / TruffleHog | Git history and entropy-based secret scanning |
| Spectral | OpenAPI style and schema lint |
| Dredd | Hitting a live server against the spec |

Those can sit next to shipcheck.

## Limits

- Next.js App Router + Pages `pages/api` + a naive Express `app\|router.(get\|post\|…)` regex (no Fastify / Nest / Remix)
- Catch-all folders map to one `{param}` as above
- README `/api/...` extraction has false positives
- Secret check is filename, suffix, and whether `.env` is tracked — not history, not entropy, not file contents

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
fixtures/pages-app         pages/api, must pass (exit 0)
.github/workflows/shipcheck.yml
LICENSE                    MIT
```

## Resume one-liner

shipcheck — TypeScript CLI that fails CI on env/secret drift and OpenAPI–code route mismatch.

## License

MIT. See [LICENSE](LICENSE).
