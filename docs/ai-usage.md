# AI Usage / Reset-aware routing

## Goal

Let FutureStaff read the local Codex allowance/reset state without exposing ChatGPT/Codex credentials to an agent, turn the sanitized snapshot into deterministic routing advice, and recommend valuable queued work that fits the preferred model.

## M0 — local reader

Run on a computer where Codex CLI is installed and logged in:

```bash
npm run ai:usage
```

The command starts `codex app-server --stdio`, performs the required initialization handshake, calls `account/rateLimits/read`, and prints sanitized JSON only. It deliberately does **not** read `~/.codex/auth.json` and does not call the model.

## Security boundary

Never return or log authentication material. Output sanitation removes nested keys matching token, secret, cookie, authorization, email and account/accountId patterns. The reader and bridge remain read-only: no login/logout, token refresh, account switching or model-turn methods.

## M1 — Local Runner bridge

The Local Runner bridge exposes the read-only capability `local.codex_usage`:

```text
Chat / MCP
  -> FutureStaff local-runner MCP (`local_codex_usage`)
  -> Runner Gateway (`POST /internal/v1/codex-usage`)
  -> enrolled desktop Local Runner (`local.codex_usage`)
  -> local Codex app-server
  -> account/rateLimits/read
```

Existing enrollment-state bindings containing only `local.system_info` are upgraded in memory; newly enrolled runners receive both read-only capabilities. Explicit static gateway bindings should include both capabilities when Codex usage is required.

```json
{
  "capabilities": ["local.system_info", "local.codex_usage"]
}
```

## M2 — deterministic quota router

Run locally against the current Codex snapshot:

```bash
npm run ai:route
```

The router does not start model work. It converts General Codex and model-specific rate-limit windows into normalized buckets containing model/limit id, primary and secondary windows, used/remaining percentage, reset time, state, and recommendation action.

### State policy

- `NORMAL`: reset is more than 6 hours away and more than 5% allowance remains;
- `HARVEST`: reset is 2–6 hours away and more than 5% allowance remains;
- `CLEAR`: reset is within 2 hours and more than 5% allowance remains;
- `EXHAUSTED`: any active constraint has 5% or less allowance remaining.

For a model with multiple active constraints, an exhausted constraint blocks that model. Otherwise the most urgent reset state wins.

### Recommendation policy

- `CLEAR` -> `USE_NOW`;
- `HARVEST` -> `PREFER`;
- `NORMAL` -> `NORMAL`;
- `EXHAUSTED` -> `AVOID`.

## M3 — backlog-aware task recommendations

Run:

```bash
npm run ai:recommend
```

This reads the current sanitized Codex quota snapshot, runs the M2 quota router, reads `tasks/AI-BACKLOG.md`, and returns up to three valuable queued tasks compatible with the preferred Codex model.

Backlog tasks may use lightweight explicit model tags:

```text
[spark] [codex] [sol] [work] [any]
```

Example:

```markdown
- [ ] [spark] Add missing focused tests.
- [ ] [codex] Audit API consistency and error contracts.
- [ ] [sol] Review tenant-isolation boundaries.
```

The recommender respects explicit tags first. Untagged tasks use conservative keyword inference. Completed checkbox items are ignored.

### Ranking policy

Task ranking combines:

1. durable value from the backlog section (`High` > `Medium` > `Filler`);
2. fit with the quota router's preferred model;
3. quota urgency (`CLEAR` > `HARVEST` > `NORMAL`).

A Spark reset does not cause the recommender to select a high-value Sol-only architecture task. Model fit is a hard filter before value ranking. General Codex may accept Spark-compatible work when useful, but Spark does not absorb Codex/Sol work merely to consume quota.

If the preferred model is `EXHAUSTED`, the recommender returns no tasks for that model.

### Explicit non-goals

M3 does not:

- execute a recommended task;
- modify the backlog;
- create Codex turns;
- schedule polling;
- send notifications;
- automatically switch models.

Those remain follow-up Atomic Tasks.

## M4 — reminders / monitoring (future)

Scheduled or conditional quota monitoring and phone notifications remain separate work. The next layer may use M3 output to decide when a useful reset warning exists, but must preserve explicit user control over task execution.

## Verification

M0 and M1 have been verified on the Windows desktop host against the real account and the full MCP -> Gateway -> Desktop Runner -> Codex app-server path. M2 has also passed desktop verification.

M3 requires:

```bash
node --test test/task-recommender.test.js
node --test test/quota-router.test.js
npm run typecheck
npm test
npm run build
npm run ai:recommend
```

With the real account snapshot, confirm that the preferred model matches M2, recommended tasks come only from open `AI-BACKLOG.md` items compatible with that model, and no sensitive credential or identity values appear in output.
