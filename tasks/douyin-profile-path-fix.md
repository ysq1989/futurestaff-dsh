# Douyin Chrome profile path failure

User reports repeated native Chrome Profile Error dialogs. Read-only metadata
showed one owned Chrome process, version 154.0.8037.93, a 233-character user-data
directory and Secure Preferences at 260 characters. Local State, Preferences and
Secure Preferences were absent; no cookies, passwords or database rows read.

Controlled blank-profile comparison with the same browser: 65-character path
created all three preferences files and exited successfully; 233-character path
failed to create all three and logged a preference error. Only disposable test
directories were used, with no real login. Existing user profile was unchanged.

Source fix retains short existing directories and uses an OS-user-owned compact
path for deep Windows profiles. Hash includes trusted workspace root, owner and
browser kind, preserving workspace/environment/tenant/member/browser separation.
Old directory remains untouched; no cookie/key decryption or transfer. Compact
directory still capped with room for Default and temporary names. Typecheck/build,
47 Node tests and 15 React tests passed; whitespace passed. Targeted installed
Host candidate prepared outside repository and syntax checked, not installed.

Evidence: D:/项目/.codex-build/ui-polish-release-20261009/profile-path-lab.json;
candidate: D:/项目/.codex-build/profile-path-fix-20261009/.
Applying the candidate requires user authorization to close/restart the owned
browser and change its existing integration directory. New profile needs a fresh
Douyin login by the user. No restart, credential access, profile deletion, commit,
push or publication performed for this fix.

User subsequently authorized the owned-browser close and client restart/profile
switch. Applied a syntax-checked targeted repair to the installed Host, verifying
that its original bytes differed only by the directory resolver and helper imports.
Original Host backup and SHA-256 receipt saved under profile-path-fix-20261009.
Installed Electron imported the repaired Host without plugin application or login.
Closed only the owned Douyin Chrome and FutureStaff process group, then restarted
FutureStaff. Old browser directories remained untouched; no cookie/key copy or
real login performed. New short profile will be created on the next account-open
action; user must log in and verify the missing native error. No new release.
