# apps/api

**Owner: API** — see [`docs/OWNER-API.md`](../../docs/OWNER-API.md).

Fastify service. The only process that imports `ai-core` and `persistence`, and therefore the only
place `ANTHROPIC_API_KEY` is read. Contract: [`docs/05-api-contract.md`](../../docs/05-api-contract.md).
