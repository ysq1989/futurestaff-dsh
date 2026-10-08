# ADR-018: Background preparation and confirmed in-app updates

Accepted 2026-10-08: the user explicitly requested background download followed
by Restart and Update, installation without a wizard, and automatic relaunch.
This supersedes ADR-016's download-only default for the FutureStaff distribution.

The new local distribution mode `confirmed-install` uses the operator-pinned
Ed25519 manifest as release authority. Windows Authenticode is not required by
this mode; the separate `signed-install` mode retains its mandatory publisher
pin. Feed data and renderer inputs cannot select delivery modes, keys or paths.
Windows protections and certificate trust are not modified.

Only packaged Windows x64 clients prepare newer releases. Background preparation
never executes or quits. A private bounded cache remembers a verified installer
after Later; persisted cache metadata is advisory, never release authority.
Every check obtains a signed current feed, binds the cache to its exact bytes,
and confines paths to generated private update directories. After the explicit
Restart and Update confirmation, recheck the signed feed and installer bytes.
Launch the existing NSIS installer with /S, --updated and --force-run, then request
orderly app shutdown only after spawn succeeds. Existing NSIS handoff handles
the running process and relaunch; interrupted/failed installation leaves the
cached package for retry. Older installed clients need one bridge upgrade.

Scope: desktop-owned updater/runtime and public release metadata. No tenant,
identity, session, schema, business API or Harness changes. Acceptance covers
background/later no-execution, cache reuse/restart, tamper/path/version rejection,
download cancellation, failed spawn preserving the app, exact silent/relaunch
arguments, full desktop/package checks and external feed/download verification.
