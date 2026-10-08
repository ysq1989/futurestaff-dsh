# FutureStaff in-app updates

Owner: desktop shell; Windows x64 packaged installations. ADR-018. Distribution
configuration selects `delivery: confirmed-install`, with background checks on.
The disabled legacy updater stays disabled. No business or tenant data changes.

After the initial one-minute delay, and then every six hours, fetch and verify
the pinned HTTPS signed feed. A newer installer downloads into the private
updates directory, with bounded size and SHA-256 verification. Notify only when
ready and expose Restart and Update in the tray. No download folder is opened.
Version-button/manual checks use the same flow and avoid a separate download prompt.

The ready dialog offers Restart and Update / Later and release notes. Later
retains the verified package across process restarts. A subsequent check obtains
a signed current feed and reuses matching, reverified cached bytes. After explicit
installation confirmation, re-fetch the signed feed and repeat size/hash checks;
reject a changed/revoked release. Launch the existing assisted NSIS installer with
`/S --updated --force-run`, then request orderly app shutdown after successful
spawn. NSIS handles replacement, preserves user data and relaunches without its
interactive wizard. Windows may still display system security/permission prompts.

Cached state stores only version, SHA-256 and a generated folder name. It cannot
choose release authority, sources or arbitrary paths. Symlinks/junctions and
paths outside generated private cache folders are rejected; failed transfers
leave no ready package. Installed versions clean their own generated cached EXE.
Failed verification or spawn never shuts down the running app. Interrupted
installations keep cached bytes for retry; prior immutable installers remain
available through release rollback metadata.

Release pipeline: reviewed clean main -> unique Windows installer -> signed
READY bundle using `delivery: confirmed-install` -> existing standalone publisher
and independent trust -> atomic feed replacement -> external HTTPS signature and
full-download hash checks. No update container restart is necessary. Paid CA
purchase is not required for this explicitly selected mode; `signed-install`
keeps mandatory Authenticode verification. Existing 2.0.11/2.0.12 clients need one
bridge upgrade using their current manual installer flow; later versions can use
the new app-managed installation. Never execute release installers during CI.
