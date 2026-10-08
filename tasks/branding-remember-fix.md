# Branding coverage and remember-checkbox follow-up

Owner: fs-platform-access product UI; High Risk shared UI/credential capability.
Main baseline 71b0d8f254; unrelated workspace changes preserved. User requests all
visible product logos unified and DeepSeek brand marks removed, plus a non-clickable
remember-password checkbox fixed.

Implemented: native hero mark slot, conversation wrapper overriding only hero
headline/preview translations and preserving existing inject/children/locale props;
browser title/favicon override using the existing bundled FutureStaff SVG. Sidebar
and login already use that mark. No upstream gitlink/source edits or model-provider
renaming. User selected the official website blue/white f. The installed native
window PNG matches the canonical repo image byte-for-byte; tray assets derive from
it. Updated the desktop shortcut to a versioned canonical ICO (target/arguments
unchanged, old link backed up) and replaced installer header/sidebar BMPs with
vector-derived f artwork. Added a deterministic installer artwork generator.

Checkbox: initial capability is now unknown, not permanently false; metadata uses
the normal JSON/session/login headers, retries on window focus and before remembered
login, and surfaces failure reasons. Actual unavailable protection still disables
saving, with no plaintext fallback. An opted-in login is refused if protection
cannot be verified. Do not claim the live encrypted-store availability was proven:
an unauthenticated read of the live private endpoint returned 403 at the shell
renderer-access boundary; no renderer token or user password was read.

Evidence: primary package 133 tests and release-source package 128 tests passed
(primary has five unrelated existing inference tests); build/typecheck passed.
Actual browser DOM fixture using the real view mount checked the checkbox and
submitted remember=true with fake credentials. Local four-file browser/view overlay
backed up under D:/项目/.codex-build/branding-fix-20261008/local-backup and applied;
restart required. Existing Host/inference/password store and user data preserved.

Validation: 128 affected package tests, desktop 1095 tests (13 existing skips),
build/typecheck/runtime closure and two Profile staging tests passed. Native/installer
artifact preparation for 2.0.18 complete. Remaining: real live post-restart availability
check by user and signed 2.0.18 publication, whose commit/push/release authorization
was explicitly granted by the user on 2026-10-08. Publication is in progress.

Acceptance incident: the custom local login overlay copied view.js without its
new brand.js import, causing ERR_MODULE_NOT_FOUND on restart. Added the missing
canonical module without replacing custom Host code. Verified installed plugin.js
and index.js imports under the installed Electron executable, and 55 relative
module references resolved. No plugin application, credential reads or login calls
were performed. Updated the overlay file manifest to include the dependency.

Taskbar issue: native startup recovery window omitted an icon, unlike the main
window, so it used the executable fallback. Added an explicit canonical f PNG
to its BrowserWindow options. Desktop build/typecheck, all 1095 tests (13 original
skips) and runtime closure checks passed. This shell code fix requires a new signed
installer; it is not active in the currently installed recovery-window code.
