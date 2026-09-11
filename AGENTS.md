# shipcheck agent rules

- Deterministic checks only. No LLM in the decision path.
- Never print env or secret values.
- Check names stay env, secrets, routes. New languages are extra parsers under routes, not new check names.
- Routers today: Next App Router, Next pages/api, Express regex, Spring annotations (src/checks/spring.ts).
- Do not add Flask, FastAPI, Nest, Django, Go, Rails, or a website unless the human explicitly asks.
- Empty OpenAPI operations (`get: {}`) are real methods.
- Spring: join class `@RequestMapping` + method mapping; empty `@GetMapping` uses the class prefix; skip `@RestControllerAdvice`; do not fake Actuator.
- Env: if the example is dotenv, compare only to `.env`. Do not diff `DB_URL` against `application.properties`.
- Fixtures that must stay green (exit 0): good-app, dynamic-app, pages-app, spring-good.
- Fixtures that must stay red (exit 1): bad-app, spring-bad.
- Do not edit other repos (e.g. sync-space) unless asked.
- TypeScript strict. No `any`.
- Windows scripts use `npx tsx`, never bare `tsx`.
