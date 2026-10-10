# System pages and controllable browser tabs

User requests Session/System navigation in the main area, browser-like tabs for
system pages, and DSH browser operations on the same displayed pages. No popups.
Shared client shell owns tab state; business plugins own their page bodies.
Pinned installed runtime is 0.1.2-rc.1, main baseline d9456cb7a4; preserve all
unrelated dirty/staged work and prior acquisition pilot.

Findings: pinned layout exposes conversation/details, not newer main-panel API.
Newer official-desktop has ui-sidebar-browser native guests and separate optional
browser-use providers; neither display nor provider support is in the pinned
installed runtime. Browser display must not be represented as model control.

Plan: scoped main-area system page registry/tab state, preserve chat while hidden,
route module launchers into tab bodies, clear bodies on logout/subject changes;
isolated native Chromium guests for external sites and a DSH Session-owned
control connection to those same guests. No iframe-only substitute for control.
Guest storage must be scoped by server-derived subject/user, never receive the
DSH renderer credential/header, and be released on identity/generation changes.
Model operations must use trusted Session identity and existing approval pipeline,
not client-supplied tenant/session identity. No credential reads or live sends.

Acceptance: click Session restores chat; System restores tab selection; opening
same module focuses one page; switching/closing tabs works; authenticated module
state persists while switching; logout revokes pages; native guest/model target
matches and another Session cannot take it; external guests cannot reach DSH Host.
No deployment/commit/public release until concrete candidate checks pass.

Initial source implementation: scoped client SystemPages registry and main-area
tab strip; sidebar mode changes control main content; original Conversation stays
mounted while hidden; duplicate module opens focus one tab; subject/user changes
clear tab bodies. Douyin launcher now opens a registered main page instead of
requesting a popup. Closing that module page waits for its task pause action.
Newer native-browser APIs were not assumed present in the pinned runtime.

Checks: platform client build/typecheck and 146 platform tests pass; Douyin UI
tab-navigation/cached-snapshot/login-loss tests updated to the new main-area flow.
No deployment, restart, commit, push or real browser operation performed.
Outstanding: product/external webpage tab host; native guest/display lifecycle;
DSH model control targeting the same guest; backend-derived browser ownership
and Session reservation/approval coverage. These are required, not optional
follow-ups; do not report a controllable browser as completed.

Asked user preference: retain current runtime with a native-browser backport
(preferred) versus upgrade runtime and integrate the official components/provider.
No answer yet; current-runtime approach is preferred to limit unrelated changes.

2026-10-10 user explicitly requested deployment. Local pilot deployed only the
two affected Client bundles/maps (platform access + Douyin), preserving their
Host code, configuration, user database and all other plugins. Software remains
2.0.21, no public installer/feed change or Git commit/push. Backup, exact hashes
and reversible replacement receipt:
D:/项目/.codex-build/system-tabs-deploy-20261010/receipt.json.
Platform build/typecheck + 146 tests passed; Douyin build/typecheck + prior 76
Node and current 18 React tests passed. Installed app restarted gracefully,
with six processes/one loopback listener. Actual UI verified System replaces
chat with page workspace, Douyin opens one non-dialog tab with a close button
and its model/profile controls; Session restores the chat area. No live browser
operation, inference or sending executed. Product Hub/external webpage hosting
and DSH-controllable native browser remain unimplemented and undistributed.
