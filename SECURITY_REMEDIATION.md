# Claude proxy security — 19 October 2026

This endpoint serves a public anonymous browser application. The original handler allowed every origin and forwarded the entire request body with the server API key.

This patch requires an exact allowed browser origin, validates JSON, limits request size/model/token budget/messages, forwards only supported fields, bounds upstream time, hides provider errors, disables caching, and applies a small per-instance client/global request budget. The existing UI model and 4000-token budget are preserved.

## Deployment review

- Production origin defaults to https://shifa.sab.id. Configure CHAT_ALLOWED_ORIGINS as a comma-separated exact list for additional production or preview origins. Do not use a wildcard.
- CORS and Origin checks are browser controls, not authentication. A scripted client can forge Origin. The in-memory limiter resets on cold starts and does not provide a distributed quota.
- Before treating abuse protection as complete, configure a durable edge/WAF rate limit on /api/chat, a bot challenge or authenticated access appropriate to this public product, and provider spend/usage limits. Verify those controls at the actual hosting/provider accounts. Do not embed a shared secret in the frontend.
- Server-only ANTHROPIC_API_KEY remains in the hosting secret store. This audit did not call Anthropic, validate this key, change its budget or alter deployments.
- Tests use a placeholder key and mocked fetch only. Run node --test tests/chat.test.js.
