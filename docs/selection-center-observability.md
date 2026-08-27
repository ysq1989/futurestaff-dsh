# Selection Center observability

## Operational questions

1. Which Selection Center operation is failing or timing out?
2. How long did the upstream request take?
3. Can one MCP call be correlated with its upstream HTTP request?
4. Did telemetry expose credentials or tenant/user identity? It must not.

## Signal

Every completed upstream request emits one JSON event to stderr:

```json
{"event":"selection_center_request_completed","requestId":"...","operation":"search_products","outcome":"success","durationMs":42}
```

Failures add only a bounded `errorCode`; logs never include API keys, tenant IDs, user IDs, request bodies, raw URLs, or upstream response bodies. The same request ID is sent as `X-Request-Id`.

This Alpha milestone deliberately avoids choosing a metrics or tracing vendor. Before production, export RED metrics from these events or OpenTelemetry instrumentation: operation rate, error/timeout rate, and duration histogram. Do not use request or identity values as metric labels.
