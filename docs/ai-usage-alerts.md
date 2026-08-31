# AI Usage Alerts

TASK-AIUSAGE-005 adds a notification decision layer on top of the verified quota router and AI backlog recommender.

## Trigger policy

The alert layer never starts model work. It only produces a notification when the preferred model has meaningful unused allowance near reset:

- `CLEAR`: alert when at least 20% remains;
- `HARVEST`: alert when at least 50% remains;
- `NORMAL`: no alert;
- `EXHAUSTED`: no alert.

The payload includes the preferred model, state, remaining percentage, reset time, minutes to reset, and up to three compatible open backlog tasks.

## Deduplication

The state key is `<limitId>|<resetAt>|<state>`. The same model/reset/state is emitted only once for the entire reset cycle. A state escalation such as `HARVEST -> CLEAR` has a different key and may produce one additional alert.

State is stored by default in `.dsh/ai-usage-alert-state.json`. The state file contains only alert keys and timestamps, never Codex credentials or account identity data.

## Commands

Dry-run against the real local account without sending or recording an alert:

```bash
npm run ai:alert:dry-run
```

Evaluate and record the alert state:

```bash
npm run ai:alert
```

Without a configured delivery URL the command returns the safe alert payload through stdout. To deliver through a mobile-capable service, set `AI_ALERT_WEBHOOK_URL` to an HTTPS endpoint. The URL is read from the environment and is never included in the notification payload or normal logs.

## Notification contract

Example shape:

```json
{
  "type": "futurestaff.ai_quota_alert",
  "model": "GPT-5.3-Codex-Spark",
  "state": "CLEAR",
  "remainingPercent": 80,
  "minutesToReset": 90,
  "resetAt": "2026-09-01T02:54:25.000Z",
  "tasks": [
    { "rank": 1, "title": "Add missing focused tests.", "model": "spark" }
  ]
}
```

## Safety boundary

The alert layer does not:

- execute recommended tasks;
- start Codex/model turns;
- change the selected model;
- mark backlog items complete;
- read `~/.codex/auth.json`;
- log token, cookie, authorization, email, accountId, secret, or webhook URL values.

Only HTTPS webhooks are accepted.

## Verification

Before merge, run on the desktop host:

```bash
node --test test/quota-alert.test.js
node --test test/task-recommender.test.js
node --test test/quota-router.test.js
npm run typecheck
npm test
npm run build
npm run ai:alert:dry-run
```

Confirm the dry-run uses the real current quota snapshot, emits either a correct alert payload or a correct non-alert reason, contains at most three model-compatible backlog tasks, and contains no sensitive credential or identity fields.
