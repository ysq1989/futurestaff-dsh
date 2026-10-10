# Douyin automatic acquisition v0.7.0

Local module workflow: current business profile → authorized-model keywords →
owned-browser video search → source-evidenced content selection → local work
watch list → periodic incremental comments → source-evidenced customer decisions
→ approved bounded outreach. User confirmed the Vietnam visa profile.

Owner/permission boundary remains Douyin Host `authorizeLocal`; no client
tenant/namespace, general browser call or caller-provided selectors. Models see
descriptions, not publisher/recipient IDs or URLs, and select bounded result
indexes with literal evidence. Only browser-returned canonical Douyin resources
can enter discovery. Content relevance never grants recipient eligibility.

Search captures page-initiated general/search/single responses whose keyword
matches the requested keyword. Per discovery pass: at most three model-generated
terms, ten typed works each, bounded bodies and 90-second deadline. Snapshot
findings bind profile version/model. Work comment scans remain bounded to page-
loaded top-level comments; pending comments continue being analyzed between
browser scan deadlines. Deleted/disabled sources stop background analysis and
automatic outreach derived solely from those sources. Existing user notes are
not treated as published video captions.

Automatic policy explicitly confirms template, send toggle, interval, daily
attempt cap, discovery interval and run lifetime. Default send toggle is false;
default review remains manual. High-intent automatic admission is a separate
explicit profile choice. Approval is volatile, bound to current profile/model/
principal, not restored by process restart or refreshed login. Model withdrawal,
rule changes, logout, pause and local browser operations stop execution.

Owned sender setup is a read-only UI check against an already eligible recipient.
It requires the exact public profile, one profile private-message action, one
private pane whose selected conversation header binds the expected recipient,
and one editor/send control. A link in the contact list cannot prove the selected
peer. Sending rechecks authenticated self and receiver, requires an empty editor,
inserts only approved literal text, and checks exact text before clicking.
Unique new outgoing receipt IDs/text are required for a sent result. Ambiguous
results retain the existing persistent unknown ledger and stop all retry.
This is an adapter contract, not evidence that current Douyin markup matches it:
real search/header/editor/receipt behavior still needs user acceptance.

The previous trusted static adapter remains governed by its existing `live`
flag; enabling the owned adapter cannot activate a disabled static adapter.
No live private send was made during implementation. The runtime UI must first
pass receiver setup and separately confirm a policy with send enabled.

Daily attempt counts persist in owner-scoped `outreach-budget`, using the explicit
Asia/Shanghai calendar. Capacity is reserved before an attempt, including failed
attempts. Contacted and opted-out recipients remain protected. Existing SQLite
table/schema v1 is reused. New logs use `run-log-automation`, importing old logs
read-only and preserving `run-log` for rollback. No credentials/message bodies/
stacks enter runtime logs. Existing sending ledger/workspace schema is retained.

Validation: 76 Node module, 19 React and 42 core tests; affected typecheck/build;
isolated browser UI including automatic-policy controls/light-theme screenshot;
installed Electron import of complete candidate lib; hash-verified local overlay
with complete code backup and graceful application restart. Real external search,
model execution and sending were not performed by the developer.

Local pilot receipt/rollback code:
D:/项目/.codex-build/auto-acquisition-deploy-20261009.
Software remains 2.0.21; no installer/feed/server deployment, commit or push.
