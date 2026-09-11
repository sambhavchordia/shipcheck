# shipcheck agent rules

- Keep checks deterministic. No LLM in the decision path.
- Never print env values.
- Do not add GraphQL, dashboards, accounts, or extra frameworks.
- New routers belong in `src/checks/routes.ts` behind tests on fixtures.
- `fixtures/bad-app` must fail. `fixtures/good-app` must pass (`--fail-on error`).
- TypeScript strict. No `any`.
