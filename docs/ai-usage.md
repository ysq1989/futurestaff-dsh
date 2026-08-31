# AI Usage / Reset-aware routing

## Goal

Let FutureStaff read the local Codex allowance/reset state without exposing ChatGPT/Codex credentials to an agent. This enables reset-aware model routing and, later, phone-triggered quota checks through the Local Runner bridge.

## M0 — local reader (this change)

Run on a computer where Codex CLI is installed and logged in:

```bash
npm run ai:usage
```

The command:

1. starts `codex app-server --stdio`;
2. performs the required `initialize` / `initialized` handshake;
3. calls `account/rateLimits/read`;
4. prints sanitized JSON only.

It deliberately does **not** read `~/.codex/auth.json` and does not call the model. Authentication stays inside the Codex process.

If `codex` is not on PATH, set `CODEX_BIN` to the Codex executable path.

## Security boundary

Never return or log authentication material. Output sanitation removes nested keys matching token, secret, cookie, authorization, email and account/accountId patterns. The intended data surface is rate-limit windows, used percentages, reset timestamps, reset-credit metadata and similar non-secret usage information.

The CLI must remain read-only. Do not add login, logout, token refresh, account switching or model-turn methods to this reader.

## M1 — Local Runner bridge

Add the read-only capability `local.codex_usage` to the existing Local Runner protocol:

```text
Chat / MCP
  -> FutureStaff local-runner MCP
  -> Runner Gateway
  -> enrolled desktop Local Runner
  -> local Codex app-server
  -> account/rateLimits/read
```

This is the step that makes the usage status available while the user is communicating from a phone. The gateway should only return the same sanitized data contract as M0.

## M2 — reset-aware routing

Use the returned windows to classify each available bucket:

- NORMAL: reset is more than 6 hours away;
- HARVEST: reset is 2–6 hours away and meaningful allowance remains;
- CLEAR: reset is less than 2 hours away and meaningful allowance remains;
- EXHAUSTED: little/no allowance remains.

Combine the status with `tasks/AI-BACKLOG.md` to recommend high-value work before an allowance resets. Do not create low-value work merely to consume quota.

## Verification

Required before merge on a machine with Codex installed:

```bash
npm run ai:usage
node --test test/codex-usage.test.js
npm run typecheck
npm test
```

Confirm the output contains real rate-limit/reset fields but no account id, email, token, cookie or authorization values.
