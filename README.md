# shipcheck

CI gate for three boring failures that still ship:

1. `.env` missing keys or placeholder secrets  
2. Secret-looking files in the tree (and `.env` not gitignored)  
3. OpenAPI / README routes that do not match the code  

No LLM. Compare files, print FAIL/WARN, exit 1.

## Run

```bash
npm install
npx tsx src/cli.ts --root fixtures/bad-app    # should fail
npx tsx src/cli.ts --root fixtures/good-app   # should pass
```

```bash
npx tsx src/cli.ts --root . --json
npx tsx src/cli.ts --root fixtures/bad-app --fail-on warn
```

## What it checks

| Check | Error when |
|---|---|
| env | Key in `.env.example` missing from `.env`, or value is `changeme` / empty / similar |
| secrets | `.pem` / `.p12` / private key names, or `.env` present without `.gitignore` entry |
| routes | Spec path+method not in Next `app/api/**/route.ts` or simple `app.get("/...")`, or README `/api/...` with no handler |

Values of secrets are never printed.

## Not this tool

Gitleaks/TruffleHog (history + entropy), Spectral (OpenAPI style), Dredd (live server). Those can sit next to shipcheck.

## Limits

- Next App Router + a naive Express regex only  
- OpenAPI YAML parser is indentation-based, not a full YAML library  
- README path extraction has false positives  

## Resume line

shipcheck — TypeScript CLI + GitHub Action that fails PRs on env/secret drift and OpenAPI–code route mismatch.
