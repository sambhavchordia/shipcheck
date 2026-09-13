# shipcheck

Fails a PR when env files, secret-looking paths, or OpenAPI/README routes disagree with the code.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)
[![CI](https://img.shields.io/github/actions/workflow/status/sambhavchordia/shipcheck/shipcheck.yml?branch=main)](https://github.com/sambhavchordia/shipcheck/actions/workflows/shipcheck.yml)

## Why

README paths, OpenAPI, and `.env.example` drift from the handlers and env files people actually ship. That still merges.

shipcheck compares those files on disk and exits 1. No crawler. No LLM in pass/fail. Secret values are never printed.

## See it

```bash
npx tsx src/cli.ts --root fixtures/bad-app
```

Exit 1:

```
FAIL  .env:2
      [env] [ENV_PLACEHOLDER] Key "JWT_SECRET" looks like a placeholder. Value not printed.

FAIL  .env
      [env] [ENV_MISSING_KEY] Missing key "AUTH_SECRET" that is listed in .env.example. Value not printed.

FAIL  .env
      [secrets] [SECRET_ENV_NOT_IGNORED] .env is tracked by git. Keep it local and commit .env.example only.

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
```

```bash
npx tsx src/cli.ts --root fixtures/good-app
```

Exit 0. A clone without `fixtures/good-app/.env` may print `WARN ENV_MISSING_KEY`; that is not a failure. With a local `.env` matching the example, output is `PASS no findings`.

Spring fixtures: `fixtures/spring-good` (exit 0) and `fixtures/spring-bad` (exit 1). Also `dynamic-app` and `pages-app` (exit 0).

## Install

Node 20+. Daily command is `npx tsx src/cli.ts`. The `bin` (`shipcheck`) is `dist/cli.js` and needs `npm run build` first.

```bash
npm install
npx tsx src/cli.ts --root <dir>
npm test
```

```bash
npx tsx src/cli.ts --root . --json
npx tsx src/cli.ts --root . --format github
npx tsx src/cli.ts --root . --fail-on error
npx tsx src/cli.ts --root . --fail-on warn
npx tsx src/cli.ts init --root .
npx tsx src/cli.ts --root . --write-baseline
npx tsx src/cli.ts --help
```

`GITHUB_ACTIONS=true` does not switch format. Pass `--format github` if you want annotations.

## What it checks

| Check | Errors when | Codes |
|---|---|---|
| env | Example key missing from `.env`, or `.env` value empty / dummy (`changeme`, `replace-me`, …). Dummy values in the example are warnings. Missing `.env` is a warning. Values not printed. | `ENV_MISSING_KEY`, `ENV_PLACEHOLDER`, `ENV_EXAMPLE_DUMMY`, `ENV_MISSING_EXAMPLE` |
| secrets | `.env` present and not gitignored, or `.env` tracked by git; filenames like `id_rsa`; suffixes `.pem` / `.p12` / `.pfx` / `.key` | `SECRET_ENV_NOT_IGNORED`, `SECRET_FILE` |
| routes | OpenAPI method+path has no handler, or the reverse; README `/api/...` has no handler. No spec is info. Invalid spec is an error (`invalid spec`). | `ROUTE_SPEC_ORPHAN`, `ROUTE_CODE_MISSING_FROM_SPEC`, `ROUTE_README_ORPHAN`, `ROUTE_NO_SPEC` |

If the example is dotenv (`.env.example` / `.env.sample`), it is compared only to `.env` — not to `application.properties`.

## What it can read

- Next.js App Router `app/api/**/route.ts` and `src/app/api` (`[id]` → `{id}`, `[...slug]` → `{slug}`)
- Next.js `pages/api` (same dynamic mapping; `export default` → GET)
- Express-like `app.get("/...")` / `router.post("/...")` regex
- Spring `@RestController` / `@Controller`: class `@RequestMapping` + method mapping; empty `@GetMapping` uses the class prefix; skip `@RestControllerAdvice`
- OpenAPI `openapi.yaml` / `.yml` / `.json`, including empty operations (`get: {}`)
- README `/api/...` mentions

## What it is not

| Tool | Difference |
|---|---|
| Gitleaks / TruffleHog | Git history and entropy. shipcheck does neither. |
| Spectral | OpenAPI style/schema lint |
| Dredd | Hits a live server |
| shipcheck.pro / shipcheckhq.com | Unrelated website-audit SaaS. This repo is a TypeScript CLI: [sambhavchordia/shipcheck](https://github.com/sambhavchordia/shipcheck) |

## Limits

- No Flask, FastAPI, Django, Nest, Go, Rails, ASP.NET, Kotlin, RouterFunction, or Spring Actuator (not faked)
- README `/api/...` globs (`/**`) can false-positive
- Secret check is filename, suffix, and whether `.env` is tracked — not history, not entropy, not file contents

## Config

Optional `shipcheck.config.json` in `--root`. CLI flags win.

```json
{
  "failOn": "error",
  "ignorePaths": ["keys"],
  "ignoreRoutes": ["GET /api/health"],
  "envExample": ".env.example"
}
```

Optional `shipcheck.ok.json` baseline (`--write-baseline` writes error+warn findings). `SECRET_FILE` and `SECRET_ENV_NOT_IGNORED` are never ignored.

## Layout

```
src/cli.ts src/run.ts src/config.ts src/types.ts
src/checks/env.ts secrets.ts routes.ts spring.ts
test/
fixtures/good-app dynamic-app pages-app spring-good   exit 0
fixtures/bad-app spring-bad                           exit 1
.github/workflows/shipcheck.yml
```

## License

MIT. See [LICENSE](LICENSE).
