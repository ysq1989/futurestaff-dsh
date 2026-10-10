# System tab and Douyin launch compatibility

Main baseline d9456cb7a4. User requested Menu renamed to System and repair of an
unresponsive Douyin entry. Preserve pre-existing code/staging and installed
custom Host/data. No schema, credential, real browser login or sending work.

Root cause: installed Douyin Client requested a standalone window whenever a
Desktop mode marker existed. The public Desktop release did not include the
earlier privately installed/uncommitted module-window support, and denied that
popup. The existing native-window implementation and its security tests are
now relevant to this repair; they were deliberately excluded from earlier UI
releases and are still not committed/published in this task.

Added an explicit Host presentation capability marker; it is not authorization.
UI uses the exact native target only when advertised and otherwise opens the
existing inline workspace. Native window support retains same-session carrier,
owned renderer-ID membership, exact-target and navigation confinement, singleton
focus and close/failure/generation cleanup. Login/subject data authority stays in
the existing Host. Visible Menu label becomes System; internal tab IDs stay stable.

Validation: Douyin typecheck/build, Node and real isolated browser fixtures and
15 React tests passed, including Desktop 2.0.21 inline fallback. Browser palette
assertions were updated from old gray values to the already-approved blue/white
tokens. Desktop build/typecheck and 1101 unit tests (13 existing skips) passed;
closure, licenses and operations passed. Loader/Profile exact-URL smokes required
the new capability marker and passed after updating those expectations. Access
144 tests passed. Actual installed launcher still contained the old condition;
backed up and changed only that condition in its Client bundle. Also backed up
and updated platform Client/.map for System caption. Installed JS syntax and diff
checks passed. Host files, databases, sessions and credentials were not changed.

Local receipt/backup: D:/项目/.codex-build/system-douyin-fix-20261009/.
Restart required for local code. No installed ASAR patch, installer execution,
restart, commit, push or new release performed. Native standalone support remains
source work for a subsequently authorized release; current client uses inline UI.
