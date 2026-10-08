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
Source implementation and authorized publication complete. Native
update-prompt styling becomes available after the new client is installed;
the older client's prompt used to install that release retains its old UI.

User explicitly requested publication; commit/push/release of 2.0.21 authorized.
Clean main candidate excludes unrelated module-window and inference changes.

Released 2026-10-09: source main 8ca21cc61010cfbced14f0733bf25c123cafed86.
Clean access 139 tests, desktop 1097 tests (13 existing skips), full build/typecheck/
closure and two staging checks passed. Native update assets and unchanged CSP,
New Session placement and 2.0.20 upgrade inventory verified inside the actual
package. Packaged Electron imported Host and resolved 59 module references.
Signed live feed/full HTTPS download verified: 130857106 bytes; SHA-256
08315a7c51147b30a9053ad787420ef8b43b5332c545d9b5badc94970ba5a972.
Feed digest 930f02bc02098ca94783b644db7261314bc07f5b6ef4385a420694746a6c93d3;
rollback 2.0.20. Private trust/READY URLs returned 404. Four UI files in the local
custom Profile were backed up and updated from verified package bytes; brand.js
dependency verified and Host hashes unchanged. No installer execution, credential
reads, business-data changes, migrations or server restart. User update/restart
and live UI acceptance remain pending. New native prompt starts after installing
2.0.21; the prompt that installs this release is still rendered by the old client.
