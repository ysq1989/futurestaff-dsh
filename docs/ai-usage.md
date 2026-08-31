# AI Usage / Reset-aware routing

## Goal

Let FutureStaff read the local Codex allowance/reset state without exposing ChatGPT/Codex credentials to an agent, turn the sanitized snapshot into deterministic routing advice, recommend valuable queued work, and optionally alert when useful allowance is close to reset.

## M0 — local reader

Run on a computer where Codex CLI is installed and logged in:

```bash
npm run ai:usage
```

The command starts `codex app-server --stdio`, performs the required initialization handshake, calls `account/rateLimits/read`, and prints sanitized JSON only. It deliberately does **not** read `~/.codex/auth.json` and does not call the model.

## Security boundary

Never return or log authentication material. Output sanitation removes nested keys matching token, secret, cookie, authorization, email and account/accountId patterns. The reader and bridge remain read-only: no login/logout, token refresh, account switching or model-turn methods.

## M1 — Local Runner bridge

The Local Runner bridge exposes the read-only capability `local.codex_usage` through MCP -> Gateway -> enrolled Desktop Runner -> local Codex app-server -> `account/rateLimits/read`.

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

## M4 — quota alerts and monitoring

Manual dry-run:

```bash
npm run ai:alert:dry-run
```

Manual real run:

```bash
npm run ai:alert
```

Alert policy:

- `CLEAR` alerts when at least 20% remains;
- `HARVEST` alerts when at least 50% remains;
- `NORMAL` and `EXHAUSTED` do not alert;
- the payload includes model, remaining %, reset time, minutes to reset, and up to three compatible backlog tasks.

### Deduplication

A successful delivery stores a key made from `<limitId>|<resetAt>|<state>`. The same model/reset/state is therefore notified at most once for that reset cycle. A later `HARVEST -> CLEAR` escalation has a distinct key and may notify once more.

Dry-run and stdout-only execution do **not** consume the dedupe state. State is persisted only after a real delivery succeeds.

### Mobile delivery

Set `AI_ALERT_WEBHOOK_URL` in the local `.env` to an HTTPS endpoint that ultimately delivers to the user's phone. The webhook URL is never included in the notification payload or normal logs. No notification credential is committed to the repository.

Without `AI_ALERT_WEBHOOK_URL`, `npm run ai:alert` safely prints the decision/payload to stdout and does not mark the alert delivered.

### Windows automatic monitoring

On the desktop Runner host, install an hourly Windows Task Scheduler entry:

```bash
npm run ai:alert:install
```

The scheduled task executes the repository-owned `scripts/run-ai-alert.cmd`. That runner changes into the repository directory, loads `.env` at runtime, invokes the quota alert command, and appends output to `.dsh/ai-alert.log`.

The Task Scheduler command itself contains no webhook URL, token, or other notification credential.

To change the interval at installation time:

```bash
node scripts/install-ai-alert-schedule.mjs --every-hours=2
```

Allowed interval: 1–24 hours. Default: 1 hour.

Remove the scheduled task with:

```bash
npm run ai:alert:uninstall
```

### Explicit non-goals

M4 does not execute recommended tasks, start Codex/model turns, switch models automatically, or mark backlog tasks completed. Task execution always remains a separate explicit action.

## Verification

M0/M1/M2/M3 have desktop verification history. M4 requires:

```bash
node --test test/quota-alert.test.js
node --test test/ai-alert-schedule.test.js
node --test test/task-recommender.test.js
node --test test/quota-router.test.js
npm run typecheck
npm test
npm run build
npm run ai:alert:dry-run
```

On Windows also verify `npm run ai:alert:install` creates `FutureStaff AI Quota Alert`, its task action references only `scripts/run-ai-alert.cmd`, and no credentials appear in the Task Scheduler action. Do not merge the TASK-AIUSAGE-005 PR without explicit user approval.
