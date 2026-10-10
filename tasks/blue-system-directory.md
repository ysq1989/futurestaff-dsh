# Blue sidebar and unified system directory

User request: blue-led sidebar, all systems under System, remove the legacy
selection-center launcher. Main baseline 44f9b29ed5. High Risk: shared frontend.
Preserve existing GEO cloud/publishing work and the separate platform checkout's
brand changes. No commit, push, installed-app update or deployment requested.

Ownership: client navigation and presentation only. Consume current server
application discovery; modules keep authorization, tenant and business data.
No schema change, business write, credential access or real external execution.

Acceptance: blue sidebar with readable states and account popup; brand systems,
registered local pages and additional authorized systems appear once; legacy
product_hub launcher absent; unavailable entries carry a clear status; safe cloud
entry pages open as tabs and recheck current authorization before navigation;
conversation persists; identity changes clear pages; keyboard tab navigation.

Status: committed, pushed and deployed locally on 2026-10-10 after explicit user
authorization. Source commit 7be3d57acf99378f5fb84d67efbf7e8a907a9963 on origin/main.
Release is scoped to the local desktop platform Client bundle/map; no unrelated
GEO Host/API changes or public release.

Validation 2026-10-10:
- Platform plugin typecheck, client build and all 150 tests passed (zero skips).
- Douyin UI and GEO typechecks passed against the shared registry declarations.
- Isolated Edge browser fixture passed at 1440x960 and 390x844, including blue
  light/dark sidebar, local/cloud tab opening, duplicate prevention, arrow-key
  focus, preserved conversation draft, account menu and logout page teardown.
- Sidebar foreground and muted colors pass WCAG AA contrast in both schemes.
- git diff --check passed. Reviewed task files and exact source/test differences;
  pre-existing GEO/Host/API changes remain outside this task. Included the narrow
  existing plugin.test.js assertion correction for the already-committed SVG
  wordmark: the clean baseline otherwise expected the obsolete text-only title.
- 21st search informed compact sidebar hierarchy; existing native controls were
  reused. 21st review returned informational token/color suggestions only.

Evidence: work/blue-system-directory/{desktop.png,narrow-dark.png,platform-tests.txt}.
Preview uses fixture module content, not live business data. Real systems remain
subject to platform discovery and their own login; cloud pages offer a browser
link from a system tab, not an embedded cloud runtime. No credential reads,
business execution, commit, push, deployment or installed-runtime restart.

Release candidate: D:/项目/.codex-build/blue-system-directory-20261010/source,
exported main plus only task files. Candidate build/typecheck and 150 tests pass.
Dependencies reuse installed pinned package directories via junctions; the
export's unrelated Windows-unsupported desktop-shell/CLAUDE.md symlink is unused.
Local deployment replaced only active profile fs-platform-access Client JS and
map; both match the committed-source build hashes. Verified all 93 other plugin
files unchanged. Backup and receipt: same evidence directory, backup/ and
receipt.json. Actual renderer verified the blue sidebar, eight System entries,
no legacy selection-center launcher. Login confirmation gate is active after
restart, so authenticated business operations were not run. The isolated browser
fixture covered tab navigation and conversation preservation without real I/O.
Client exited through its orderly shutdown flag and restarted from its install
directory. Temporary loopback CDP validation was removed by a final normal
restart. Installer version, public installer/feed, Host and user data unchanged.

Rollback: revert only this task's sidebar/appearance/registry/directory source
and tests plus design decision/tracker paragraphs, then rebuild the plugin.
Preserve all unrelated working-tree changes; no migration or data rollback needed.
