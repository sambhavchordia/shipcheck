Continue this repo. Do not start over.

shipcheck is a TypeScript CLI. It already has:

- src/cli.ts, src/run.ts, src/types.ts
- checks: env, secrets, routes
- fixtures/bad-app (must fail) and fixtures/good-app (must pass)

Your job:

1. Run `npm install` then `npx tsx src/cli.ts --root fixtures/bad-app` and `--root fixtures/good-app`.
2. Fix any bugs so bad fails with errors and good exits 0.
3. Add 3–5 unit-style tests if you can do it with node:test and no extra framework. Cover: placeholder detection, Next route parsing, OpenAPI YAML path parse.
4. Do not add an LLM, a website, or extra checks.
5. Keep README accurate.

If something is unclear, follow AGENTS.md.
