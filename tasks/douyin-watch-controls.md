# Watch deletion, task controls and runtime logs

User requested watch deletion, startup buttons and runtime logs, then clarified
both collection/analysis and private-message sending are needed. Owner: local
Douyin workspace/Host, not Platform. Main baseline d9456cb7a4. Preserve prior
profile-path/launcher/native-window work. No production data or real sends.

Implemented source: confirmed watch-delete action, owner-scoped removal with
comment/candidate/opt-out preservation; visible delete confirmation; persistent
bounded 200-entry runtime logs in an existing SQLite namespace (no table/schema
change), combined with actual send engine events. Sender startup/pause controls
remain visible with preview/live verification guards; no implicit send approval.

Collection/analysis task controller implements startup, pause/abort, bounded
trusted results, exact source/work matching, per-watch scheduling, analysis and
failure state. A trusted Host collector port must be supplied after real-page
calibration; renderer/model input cannot inject it. An uncalibrated port cannot
start or display running. Pause/deletion/login or rule changes stop collection;
sending starts after collection stops. Task state never resumes on restart.

Validation: module typecheck/build and 52 Node plus 16 React tests passed,
including deletion/denial-data preservation, scoped logs, absence of implicit
delete, safe sender guards, collector source mismatch rejection and paused scan
write rejection. Real isolated browser fixture covers the expanded eight-tab UI.
Diff whitespace checked. No source deployment, restart or real sending performed.

Outstanding required integration: connected owned-browser DOM calibration and
the actual collection/sender adapter. Current production config has no calibrated
collector and real sending remains disabled. Asked whether the dedicated browser
is logged in and whether read-only page-structure inspection is authorized;
Read-only inspection was authorized, but Windows Computer Use stopped because
it could not reliably determine the browser URL. Do not report collection/private sending as fully implemented
or live-ready until those adapters and real acceptance are complete.

2026-10-09 local acceptance deployment: user explicitly requested deployment to
test. Typecheck/build, 53 Node and 16 React tests passed. Task-readiness codes
are allowlisted through the Host bridge. Backed up only the installed Douyin
plugin lib and staged/verified the candidate in installed Electron Node mode.
Gracefully exited FutureStaff Agent using its installer-quit channel, switched
the lib directory, verified all installed hashes, and restarted. Main remains
d9456cb7a451b2acd35c0da1a7b109ed8b034930; no commit/push/public release.
Receipt/backup: D:/项目/.codex-build/watch-controls-deploy-20261009.
Profile configuration and existing user database were not manually changed.
Observed the actual desktop load successfully with the existing watch list,
eight function tabs, delete controls, runtime-log tab and explicitly disabled
uncalibrated collection controls. No deletion, inference, collection or sending
was performed for acceptance. Software remains 2.0.21; local plugin update only.

User acceptance found the disabled collection button and immovable overlay.
Collection remains incomplete, not a click defect: no real collector is supplied.
Requested an owned-browser works page with a visible address bar for read-only
calibration after the prior browser policy stop. This response is still pending.
Implemented movable in-app fallback: bounded viewport-sized dialog, pointer
capture on non-interactive title bar, keyboard arrows, resize clamping, and
unchanged native standalone mode. 53 Node + 17 React tests and typecheck/build
passed; pointer drag, keyboard movement, keeping close accessible covered.
Client-only patch deployed/backed up under the same deployment directory:
move-window-receipt.json and move-window-backup. Host/config/data untouched.
Application restarted; actual desktop now shows expired FutureStaff login.
Did not automate authentication. User must log in to test the new title bar.
This is movement within the main window, not a newly published native window.

2026-10-09 continuation authorized by user: implemented internal AccountBrowser
collector over its existing owned CDP session, with bounded page-initiated network
responses, exact resource/author/comment binding, authenticated self verification
before and after scan, image/video discovery and bounded public comment ingestion.
Default Host assembly now supplies this collector; no external computer-use
connection or general Renderer browser API. Fixed codes persist in runtime logs.
Await cancellation settlement before destructive/local browser actions; fresh
login rebinds monitor cancellation without resuming approval. Existing sender
configuration remains live:false; this work does not complete real private sends.

Checks: build/typecheck, 60 Node tests (59 full suite plus the added service-path
test validated in the 16-test service suite), 17 React tests and 40 core tests
passed. New tests validate network observer lifecycle, endpoint/resource/author
matching, body/schema limits, identity change, abort, explicit startup through
stored evidence/AI decisions, and sanitized failure persistence. Real browser
fixture remains isolated; no live Douyin scan or platform inference was run.

Installed current candidate into this same local Profile after Electron import
verification, full lib backup/hash comparison and graceful application restart.
Receipt/backup: D:/项目/.codex-build/internal-collector-deploy-20261009.
No configuration/data manual edits, commit, push or public installer release.
Real-page behavior still requires user acceptance: open/check owned browser,
select model, start enabled watches. Missing responses or schema changes stop
with actionable codes. Native independent-window publication and actual sender
integration remain separate outstanding work; do not mark the overall task done.

Final acceptance candidate: scheduler reads only one oldest-due source per tick
and analyzes at most five pending comments, avoiding a list-wide 90-second batch.
Missing published titles/parent text remain empty; user watch notes are never
substituted as published evidence. Additional bounded/fair-scheduler test passed.
Final changed-area 27 Node tests (reader + monitor + service), prior full-area
suite and 17 React/40 core tests pass; final build succeeds. Candidate import
checked with installed Electron process ExitCode, then backed up/switched and
restarted. Final receipt: D:/项目/.codex-build/internal-collector-final-20261009-r2.
Startup is healthy at process/listener level; application login was required
during previous on-screen check. No authentication UI automated, no live scan or
send executed. User must log in, open/check the owned Douyin browser, select model
and explicitly start collection for real acceptance.
