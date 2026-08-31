# AI Usage / Reset-aware routing

## Goal

Let FutureStaff read the local Codex allowance/reset state without exposing ChatGPT/Codex credentials to an agent, then turn the sanitized snapshot into deterministic routing advice.

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

The router does not start model work. It converts General Codex and model-specific rate-limit windows into normalized buckets containing:

- model / limit id;
- primary and secondary windows;
- used and remaining percentage;
- reset timestamp and minutes to reset;
- window state;
- effective model state;
- recommendation action and reason.

### State policy

- `NORMAL`: reset is more than 6 hours away and more than 5% allowance remains;
- `HARVEST`: reset is 2–6 hours away and more than 5% allowance remains;
- `CLEAR`: reset is within 2 hours and more than 5% allowance remains;
- `EXHAUSTED`: any active constraint has 5% or less allowance remaining.

For a model with multiple active constraints (for example Spark 5h primary plus 7d secondary), an exhausted constraint blocks that model. Otherwise the most urgent reset state wins. The router preserves every individual window so callers can explain the decision.

### Recommendation policy

- `CLEAR` -> `USE_NOW`: use the model for high-value suitable work before reset;
- `HARVEST` -> `PREFER`: prefer the model for suitable queued work;
- `NORMAL` -> `NORMAL`: choose by task fit rather than quota pressure;
- `EXHAUSTED` -> `AVOID`: route to another usable model.

The current model inference maps the `GPT-5.3-Codex-Spark`/`codex_bengalfox` bucket to Spark and the general Codex bucket to GPT-5.3-Codex.

## M3 — backlog-aware recommendations (not part of M2)

A later task may combine router output with `tasks/AI-BACKLOG.md` to recommend concrete high-value Atomic Tasks. M2 deliberately does not read, modify, schedule, or execute backlog work.

## M4 — reminders / monitoring (not part of M2)

Scheduled or conditional quota monitoring and phone notifications remain separate work. M2 is a pure routing layer and has no background loop.

## Verification

M0 and M1 have already been verified on the Windows desktop host against the real account and the full MCP -> Gateway -> Desktop Runner -> Codex app-server path.

M2 requires:

```bash
node --test test/quota-router.test.js
npm run typecheck
npm test
npm run build
npm run ai:route
```

With the real account snapshot, confirm General Codex and GPT-5.3-Codex-Spark are both normalized and the recommendation matches their real reset pressure. No sensitive credential or identity values may appear in the router output.
