# Platform-managed desktop chat v0.1.0

Local implementation, 2026-09-20. Platform reference: ADR-0039 in the FutureStaff repository. Identity remains v0.1.1; inference uses an independent `0.1.0` wire version.

## Ownership and scope

- Platform owns model selection authorization, supplier credentials, quota admission and inference audit. DSH owns local conversation history, model chunk rendering and existing tool approval/execution. No supplier credential reaches the Renderer.
- Host provider `futurestaff`, model alias `default`; each call captures the current authenticated user/tenant/default model and its cancellation generation. The product replaces the upstream default-model service and disables direct DeepSeek/pi-ai adapters.
- Text and tool proposals/results only. Image attachments and reasoning replay are not advertised or silently forwarded. Existing unbound conversations containing assistant/tool history must be restarted. Ownership bindings live under hashed session IDs in OS-protected storage and survive restart/logout.
- This does not implement multi-user UI/history hiding, change existing MCP authorizations, execute tools on Platform, or add a second agent runtime.

## HTTP contract

`POST https://dev.fsstory.net/desktop/v1/chat`; Host-only desktop Bearer token. Redirects forbidden. JSON body, 512 KiB maximum:

```json
{"requestId":"<uuid>","modelId":"<authorized model uuid>","messages":[{"role":"user","content":"hello"}],"tools":[],"maxTokens":4096}
```

No user/tenant ID, provider URL or credential fields. `role` is system/user/assistant/tool. Assistant `toolCalls` contain id/name/arguments (JSON object encoded as string); tool messages use `toolCallId`. Calls/results must be paired in order. Tools contain name/description/parameters. Extra fields are rejected. Server caps output using platform model configuration and permits only enabled tenant-owned or global models.

Success: `application/x-ndjson`, `x-futurestaff-chat-contract: 0.1.0`, `cache-control: no-store`.

```json
{"type":"text","text":"hello"}
{"type":"result","content":"hello","toolCalls":[],"finishReason":"stop"}
```

`finishReason`: stop/tool-calls/max-tokens. Result content is authoritative (the unified provider may normalize streamed whitespace). Proposal names must belong to offered tools. A terminal result is mandatory; premature EOF, invalid schemas/version or unknown tool names fail closed. No raw provider error is forwarded:

```json
{"type":"error","code":"PROVIDER_UNAVAILABLE"}
```

Pre-stream errors use HTTP 401/403/409/413/422/429/503 with a bounded error code and contractVersion. The Host does not automatically retry paid calls. Platform reuses its existing provider transport; some providers stream text progressively, while others produce a final response only.

## Resource and security controls

- Server revalidates desktop membership and model ownership per request. Redis provides one concurrent request per user and 24-hour duplicate request rejection. User conversation quota is reused; each model invocation (including tool-follow-up/title calls) consumes an invocation admission.
- Desktop model daily budget, when configured, conservatively reserves input bytes plus overhead and capped output for at most three existing transport attempts. Reservations are not refunds or accurate billing measurements. Other legacy platform callers are not accounted by this desktop-only counter.
- Platform producer deadline 120 seconds, bounded output and queue; Host deadline 130 seconds. Disconnect closes provider and releases only its own Redis lease. Metadata audit precedes invocation and records terminal status without prompt/reply/tool content.
- Exit, refresh or tenant/account change aborts the captured Host generation; old prepared calls cannot send under new credentials. Local persisted session ownership blocks cross-user/tenant reuse even after restart.

## Validation / release

Focused Node/Python tests include wire parsing, tenant/model denial, no credential reflection, truncation, duplicate admission, quota, cancellation and real Cordis registration/disposal. Optional cross-repo test: build fs-platform-access, then set `DSH_CONTRACT_TEST_ROOT` to this checkout when running Platform `tests/test_desktop_chat.py`.

The already-delivered 2.0.7 installer does NOT include this work. No platform deployment, real-account/provider request, new installer, commit or push is implied by local tests. Publish the Platform route before a separately versioned desktop candidate; test real login/text/cancel/tool approval in authorized DEV. Rollback removes the route and client provider; no schema migration is needed.
