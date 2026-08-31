# AI Usage / Reset-aware routing

## Goal

Let FutureStaff read the local Codex allowance/reset state without exposing ChatGPT/Codex credentials, turn that sanitized snapshot into deterministic routing advice, and recommend useful queued work on demand.

## M0 — local reader

Run on a computer where Codex CLI is installed and logged in:

```bash
npm run ai:usage
```

The command starts `codex app-server --stdio`, performs the initialization handshake, calls `account/rateLimits/read`, and prints sanitized JSON. It deliberately does **not** read `~/.codex/auth.json` and does not call the model.

## Security boundary

Never return or log authentication material. Output sanitation removes nested keys matching token, secret, cookie, authorization, email and account/accountId patterns. The reader remains read-only: no login/logout, token refresh, account switching or model-turn methods.

## M1 — Local Runner bridge

The Local Runner exposes the read-only capability `local.codex_usage` through MCP -> Gateway -> enrolled Desktop Runner -> local Codex app-server -> `account/rateLimits/read`.

## M2 — deterministic quota router

Run:

```bash
npm run ai:route
```

State policy:

- `NORMAL`: reset is more than 6 hours away and more than 5% remains;
- `HARVEST`: reset is 2–6 hours away and more than 5% remains;
- `CLEAR`: reset is within 2 hours and more than 5% remains;
- `EXHAUSTED`: an active constraint has 5% or less remaining.

For multiple active constraints, an exhausted constraint blocks the model. Otherwise the most urgent reset state wins.

## M3 — backlog-aware task recommendations

Run:

```bash
npm run ai:recommend
```

The recommender reads `tasks/AI-BACKLOG.md` and returns up to three valuable open tasks compatible with the preferred model. Backlog tasks may use `[spark]`, `[codex]`, `[sol]`, `[work]`, or `[any]`. Model fit is a hard filter before value ranking, so Spark is never assigned Sol/Codex-only work merely to consume allowance.

## M4 — on-demand usage advisor

Run:

```bash
npm run ai:advisor
```

This is the normal user-facing entry point. It performs the existing read -> route -> backlog recommendation pipeline and returns one compact object containing:

- all normalized quota buckets;
- each model's state, remaining percentage, next reset and reset distance;
- the preferred model;
- an action: `USE_NOW`, `PREFER`, `NORMAL`, or `AVOID`;
- whether there is current quota-harvest pressure;
- up to three compatible backlog tasks;
- a short summary explaining the current recommendation.

The advisor is intentionally **on demand**. It does not poll in the background, schedule Windows tasks, send phone notifications, use webhooks, modify backlog state, switch models, or start Codex turns.

Typical interaction:

```text
User: 看看现在额度怎么用
FutureStaff: read current quota -> route -> recommend -> return advisor result
```

Example shape:

```json
{
  "preferredModel": "GPT-5.3-Codex-Spark",
  "action": "PREFER",
  "shouldHarvestNow": true,
  "summary": "GPT-5.3-Codex-Spark: HARVEST; 80% remaining; reset in about 240 minutes.",
  "models": [],
  "tasks": []
}
```

## Verification

M0/M1/M2/M3 have desktop verification history. M4 requires:

```bash
node --test test/usage-advisor.test.js
node --test test/task-recommender.test.js
node --test test/quota-router.test.js
npm run typecheck
npm test
npm run build
npm run ai:advisor
```

With the real desktop account, confirm that `ai:advisor` returns current General Codex and GPT-5.3-Codex-Spark data, selects the same preferred model as the quota router, returns only compatible open backlog tasks, and contains no token/cookie/authorization/email/accountId/secret values.

TASK-AIUSAGE-005 remains read-only and on-demand. Verification may commit + push fixes, but the PR must not be merged unless the user explicitly approves merging.
