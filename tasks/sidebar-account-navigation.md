# Subject and account sidebar

Owner: fs-platform-access product Client. Main baseline 4b7bb383c5;
pre-existing staged and working-tree changes preserved. Shared frontend change;
no API/schema, credential, permission or server authorization changes.

User requests subject logo/name at the top, Session/Menu tabs, and account plus
installed version at the bottom. Settings and logout appear after clicking the
account. Includes the previously requested Normal/Task mode naming.

Implementation uses the public sidebar slot seam, retaining the native child
declarations, navigation injection, workspace/session browser, module launchers
and settings panel. Settings remain mounted for modal/onboarding lifetimes; only
the trigger row is hidden while the account menu is closed. Native logout remains
the existing Host route. Identity is selected from the authenticated snapshot's
active subject; absent or invalid context does not display stale account data.
Missing/broken subject logos use a subject initial. Version comes from the shell's
dsh-desktop-version marker, with an explicit unavailable state outside Desktop.

Session/Menu panels stay mounted across tab changes, retaining search state.
Changing subject remounts their local views and settings, closes the account
menu and selects Session. Tab keyboard navigation, collapsed expansion, outside
dismissal, Escape and focus return are implemented. Platform/custom roles stay
available; developer modes are hidden only in the new-session picker, with an
already-staged legacy selection kept truthful. Actual mode IDs/tools are unchanged.

Validation: access package typecheck/build and all 141 tests passed; exact diff
and whitespace reviewed. Real product sidebar rendered in a browser fixture with
mock controller and child slots: initial settings hidden, Session/Menu switching,
search persistence across tabs, module action, settings dialog surviving account
menu dismissal, keyboard tabs, collapsed expansion, subject identity update,
search reset on subject change and fake logout verified. Fixture does not claim
live platform login or native settings RPC execution. Screenshot and logs:
D:/项目/.codex-build/branding-fix-20261008/sidebar-menu-preview.png and sidebar-tests.log.

Implementation complete. User subsequently authorized commit, push and publication;
2.0.19 is now published and verified. User restart/update acceptance remains pending.

Compact login follow-up: removed the subject-selection return/logout button;
gate cards now cap at 380px instead of 520px. Browser fixture measured 380px and
exact horizontal centering, and selected-subject submit still worked. Screenshot:
D:/项目/.codex-build/branding-fix-20261008/compact-subject-preview.png.

Native-registry compatibility correction: real StoredEntry keeps locale, inject,
children and store at its top level; options contains only cell metadata. The
earlier mocks incorrectly nested these fields and masked the ineffective hero
override. Duplicate child declarations are rejected by the native registry, so
the pinned 0.1.2-rc.1 adapter now decorates the existing entry's component during
plugin startup and restores its previous component on disposal. It preserves the
original entry identity and all registration/authorization faces without creating
shadow children or editing upstream. Product updates require a renderer restart;
this is not a general hot-reload API. A regression using the actual installed
SlotCore verifies hero/mode copy, unchanged native composition and disposal.
Final access regression: 142 tests passed; typecheck/build and diff checks passed.

User explicitly authorized commit, push and deployment for this complete UI follow-up.
2.0.19 released; rollback is 2.0.18.

Published 2026-10-08 from main 3261684a64f2a0c6f6dd185a4e8351e20b2e0c13.
Clean source access 137 tests passed (primary 142 includes five existing inference
tests), desktop 1095 passed/13 original skips, all typecheck/build/closure and two
Profile checks passed. Packaged Electron imported Host entrypoints and resolved
58 relative module references; all staged Profile hashes, native icon, UI copy,
missing-view dependency protection and previous 2.0.18 upgrade inventory verified.
Live signature/full HTTPS download verified: 130851077 bytes, SHA-256
e3f74ef498690851828a2c3488905c4b330c4792df301e8f2e40b11e7d7e82f4.
Feed SHA-256 1f1203fa9f7eb28905c2075fc4a1d549b51ed76248bfa8cda02ef8b1a6d034f4.
Private trust/READY requests returned 404. Local custom Profile client.js/.map and
view.js/.map backed up and updated from the verified package; canonical brand.js
dependency checked and plugin.js/index.js hashes unchanged. No installer execution,
credential reads, business-data changes, migration or server restart performed.
Restart/update and real login/UI acceptance remain with the user.

Acceptance incident: 2.0.19 still showed the native sidebar and copy. Declaration
callbacks ran before native occupants existed, returned a no-op, then never
reconciled for later registrations. Fixed with public registration subscriptions
and a losing transient entry to invalidate already-mounted outlets. Preserved
entry composition and disposal. Real native renderer wrappers also required hiding
the settings trigger inside the data-slot anchor, not the anchor itself.
Primary 144 tests and actual native renderer late-registration browser fixture
passed: subject header, account/version footer, tabs, normal/task copy, FutureStaff
Agent title and initially hidden settings all verified. Same feature release
authorization remains in scope; 2.0.20 correction published and verified.

Correction release complete: source main ae3e0138d0f22ef5c68ee5a15f641c3dfa9cd968;
primary access 144, clean access 139, desktop 1095 tests (13 existing skips),
build/typecheck/runtime closure and two staging tests passed. Native renderer
fixture first showed the old sidebar/title, then public registration observation
and invalidation switched mounted outlets to the new subject/account/sidebar,
FutureStaff Agent title and Normal/Task labels. Also tested native registration
after product setup. Native settings anchor initially hid its trigger and showed
it only on account click. Fixture uses mock identity, not actual platform login.
Proof: D:/项目/.codex-build/sidebar-lifecycle-20261008/native-renderer-fixed.png.
Packaged Electron imported Host and resolved 59 local references; staged hashes,
UI markers and prior 2.0.19 upgrade inventory verified. Live signature and full
HTTPS installer verified: 130856151 bytes, SHA-256 ff5985ea149516dad5514566847c2fae7680c547986e4dbb6ebdab1eab179c5b.
Feed digest 0a87ab5da4380b2f979483b44c17081ca23cdb1a0259cba29cf6c1f55b009ad7;
rollback 2.0.19. Local client.js/.map and view.js/.map backed up and atomically
updated; brand dependency checked and custom Host hashes unchanged. No installer
execution, credential reads, business-data changes or server restart. User
restart/update and actual acceptance remain pending.
