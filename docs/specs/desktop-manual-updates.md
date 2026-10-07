# Desktop manual updates

The user selected this delivery flow on 2026-10-08. See ADR-016.

The default `futurestaff-updates` distribution row has `delivery: manual-download`.
It uses the FutureStaff-controlled HTTPS feed and a pinned Ed25519 public key.
The installer need not have a paid Windows publisher signature for this mode.
After validating the feed, exact package size and SHA-256, the desktop reveals
the EXE in a private download directory. The user starts installation themselves;
the desktop does not execute the EXE or quit/restart automatically. Windows may
display a publisher/security prompt. No Windows protection or certificate trust
setting is changed by this feature.

`delivery: signed-install` is optional and still requires an approved Authenticode
certificate pin. Its original verification and installation checks remain intact.
Switching modes is a distribution decision, never controlled by feed data.

## Release procedure without paid certificates

1. Generate a free Ed25519 manifest key using
   `node scripts/initialize-desktop-update-key.mjs <new-external-directory>`.
   The key directory is protected with Windows account ACLs (0700 on POSIX), and
   existing directories/keys are never overwritten. Keep the private key outside
   Git; put only the public key in the desktop distribution and operator trust file.
2. Build a uniquely versioned private Windows installer from reviewed, clean main
   using `npm run installer:windows`. Historical installers are never overwritten.
3. In the local release config select `delivery: manual-download` and specify the
   pinned manifest URL/public key, private-key path, current installer, older
   rollback installer, versions, release notes and a new absolute output directory.
   No Windows certificate thumbprint is required in this mode.
4. Run `node scripts/prepare-desktop-update.mjs <local-config.json>` and publish
   the resulting READY bundle with `scripts/publish-desktop-update.mjs` and an
   independent operator trust file. Only public release artifacts enter the webroot.
5. Serve the feed with `Cache-Control: no-store` and immutable versioned EXE URLs;
   verify the HTTPS downloads and exact hashes. Install 2.0.11 manually once to
   get the new updater; then test a subsequent newer release through the version
   button and tray, including a damaged-package rejection.

`docker/nginx/desktop-updates-location.conf` is a prepared include for the existing
HTTPS container, with a read-only public release mount. It serves only the feed
and versioned installers, excluding administrative/temporary files. Verify it
against the actual server's current configuration and run `nginx -t` before any
reload. This file has not been applied to the live server.

The intended feed is `https://fsstory.net/desktop-updates/stable.json` on the user's
main-server hosting infrastructure. This URL is a configured destination, not
evidence of a completed deployment. Publication requires authenticated server
access; no live feed or successful installed-client upgrade is claimed before
those checks pass. Certificate vendor enquiries/purchases are deferred.
