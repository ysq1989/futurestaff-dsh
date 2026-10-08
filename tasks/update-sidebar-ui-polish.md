# Update dialog and sidebar UI polish

Owner: desktop native update presentation and fs-platform-access sidebar.
Main baseline 0ccd9139a0. Preserve unrelated working-tree and staged changes.
Shared UI/update boundary validation; no schema or authentication changes.

User requested a better-looking update prompt and blue/white sidebar, with New
Session inside the Session tab. Implemented a dedicated branded update surface:
official inline website SVG, target version, separate release notes and advisory,
white Later action and blue Restart and Update action. Visual emphasis is separate
from focus: Later remains the default/cancel action and original response indices
are unchanged. Signed feed recheck, cache/hash validation, installer spawn and
quit remain on the existing confirmation-gated path. No CSP changes; SVG content
is the reviewed static repository brand asset, never remote or release input.

New Session is mounted inside the Session panel and hidden on Menu. Selected
tabs and the new-session action are blue; lists remain white and the account row
has a light-blue surface. Existing theme variables and role/account boundaries
remain in use. Session/Menu state and native registration lifecycle are retained.

Validation: native build/full desktop gate passed 1100 tests (13 existing skips;
includes existing unrelated local window tests). Subsequent asset correction
retained CSP; focused native UI/window/runtime regression passed 83 tests and
affected native UI/client-test/Host-test typechecks passed. Access build and 144
tests passed. Real native slot renderer browser verified New Session inside
Session and not visible on Menu. Built native dialog preview verified logo,
layout and Later focus. No real installer action was invoked. Exact diff and
whitespace reviewed. Evidence lives under
D:/项目/.codex-build/sidebar-lifecycle-20261008/.

Screenshots: sidebar-blue-white.png and update-dialog-polished.png.
Source implementation complete; not committed, pushed or published. Native
update-prompt styling becomes available after the new client is installed;
the older client's prompt used to install that release retains its old UI.

User explicitly requested publication; commit/push/release of 2.0.21 authorized.
Clean main candidate excludes unrelated module-window and inference changes.
