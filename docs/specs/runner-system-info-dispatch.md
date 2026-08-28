# Spec: DSH to Local Runner system-info dispatch

## Objective

Let the FutureStaff Alpha DSH call one no-argument MCP Tool, `local_system_info`, which dispatches the fixed read-only `local.system_info` capability through the private Runner Gateway to the currently bound computer.

## Assumptions approved by continuation

- The first Alpha deployment routes to one configured `RUNNER_ID`; the model cannot choose a Runner.
- Gateway dispatch uses a separate high-entropy internal bearer token.
- The dispatch endpoint is reachable only on the private/loopback Gateway port and is never added to Nginx.
- No tenant, user, device, Tool name, or Tool arguments are accepted from model input.

## Tech stack and structure

- Extend `runner/gateway/` with `POST /internal/v1/system-info`.
- Add `mcp/local-runner/` as a stdio MCP adapter used by the FutureStaff Profile.
- Use Node HTTP/fetch, MCP Server 2.0, Zod 4, and existing Runner workspaces.
- Add ADR-010 and deployment/acceptance documentation.

## Contract

```text
POST /internal/v1/system-info
Authorization: Bearer <internal dispatch token>
Content-Type: application/json
X-Request-Id: <correlation ID>

{"runnerId":"server-configured-runner"}
```

Success is `200 {"data":{...systemInfo}}`. Errors always use `{"error":{"code","message","retryable"}}`; unauthorized is 401, invalid input 400, unavailable Runner 503, timeout 504, and unexpected failure 500.

The MCP Tool has an empty input schema. Its configured client injects Runner ID and internal credentials.

## Observability questions

1. Was an internal request authenticated and valid?
2. Was the selected Runner offline, stale, timed out, or successful?
3. How long did the cloud-to-device round trip take?

Logs contain request ID, stable outcome, Runner ID, and duration only. Tokens, subject IDs, arguments, and returned host data are never logged.

## Testing strategy

- Gateway integration tests cover unauthorized, malformed, offline, and real WebSocket success.
- MCP tests prove empty model input and trusted configured routing.
- A deployed end-to-end call must return the current Windows computer's validated system-info shape.

## Boundaries

- Always: authenticate, cap request body, validate JSON and response, timeout, correlate, redact.
- Ask first: adding more Runner capabilities or allowing model-selected devices.
- Never: proxy the internal route through Nginx, accept identity/Tool fields, log secrets or returned system information, modify DSH Core.

## Success criteria

- `local_system_info` appears in the DSH Profile.
- A real call traverses DSH-side MCP → private Gateway → current Windows Runner → Gateway → MCP.
- The public domain cannot reach the internal dispatch endpoint.
- Full repository and clean container checks pass.
