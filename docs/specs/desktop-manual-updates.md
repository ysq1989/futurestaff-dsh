# Desktop manual updates

This operator-selectable mode remains available (ADR-016). The user subsequently
selected confirmed in-app installation as the distribution default (ADR-018);
see [the current flow](desktop-in-app-updates.md).

An operator can set the `futurestaff-updates` row to `delivery: manual-download`.
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

The live feed is `https://fsstory.net/desktop-updates/stable.json` on the user's
main server (published and externally verified 2026-10-08). The dedicated
`futurestaff-prod-desktop-updates` Compose project serves a read-only public mount
through loopback 3178 and the host HTTPS proxy. `docker/compose.updates.yml`,
`docker/nginx/desktop-updates-server.conf` and `desktop-updates-host.conf` describe
the runtime. The current host reuses its audited immutable nginx image ID
`sha256:c6d108360ade1083cd9d78943b393515c98b068c77ee70f339508c25a3163321`.
The new hostname uses a free Let's Encrypt website certificate and the existing
ACME renewal cron; no paid Windows certificate or vendor enquiry was needed.

Runtime paths are `/opt/futurestaff/prod/desktop-updates-runtime`,
`desktop-update-bundles/2.0.11` and `desktop-updates-public`. Operator trust remains
outside the public webroot. First user installation and a subsequent installed
client upgrade remain manual acceptance steps, distinct from the verified HTTPS
feed, signature and full-download hash checks.

Rollback restores the prior signed feed and its unchanged immutable installers.
For this first deployment, disable only the new fsstory.net vhost and stop only
the dedicated updates Compose project if hosting must be withdrawn; preserve
release artifacts and certificate/renewal configuration for recovery. Validate
host nginx before reloading, and leave all other application projects untouched.
