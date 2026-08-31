# AI Usage / Reset-aware routing

## Goal

Let FutureStaff read the local Codex allowance/reset state without exposing ChatGPT/Codex credentials to an agent. This enables reset-aware model routing and phone-triggered quota checks through the Local Runner bridge.

## M0 — local reader

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

The reader and bridge are read-only. Do not add login, logout, token refresh, account switching or model-turn methods to this capability.

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

The Runner uses the same app-server request and recursive sanitation rules as the verified M0 reader. The gateway validates the returned envelope, and the MCP only exposes the sanitized snapshot.

Existing enrollment-state bindings that contain only the original `local.system_info` capability are upgraded in memory to include `local.codex_usage`; newly enrolled runners receive both read-only capabilities. Explicit static gateway bindings should include both capabilities when Codex usage is required.

Example:

```json
{
  "capabilities": ["local.system_info", "local.codex_usage"]
}
```

## M2 — reset-aware routing

Use the returned windows to classify each available bucket:

- NORMAL: reset is more than 6 hours away;
- HARVEST: reset is 2–6 hours away and meaningful allowance remains;
- CLEAR: reset is less than 2 hours away and meaningful allowance remains;
- EXHAUSTED: little/no allowance remains.

Combine the status with `tasks/AI-BACKLOG.md` to recommend high-value work before an allowance resets. Do not create low-value work merely to consume quota.

## Verification

M0 was verified on Windows against a logged-in ChatGPT Pro Lite / Codex installation and returned General Codex plus GPT-5.3-Codex-Spark rate-limit windows with no sensitive fields.

M1 must be verified before merge on the desktop Runner host:

```bash
npm run typecheck
npm test
npm run build
```

Then start the normal Runner Gateway + Local Runner stack and call `local_codex_usage` through the local-runner MCP. Confirm the end-to-end path is:

```text
MCP -> Gateway -> Desktop Runner -> Codex app-server
```

The returned data must include the real General Codex and Spark usage/reset fields while containing no account id, email, token, cookie or authorization values.
