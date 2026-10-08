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

Implementation complete; commit/push/packaging/publication not performed. Previous
2.0.18 authorization and live artifact are unchanged. User release acceptance is
pending after a separately authorized release.

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
2.0.19 release in progress; rollback is 2.0.18.
