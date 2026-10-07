# Desktop update publication

For the default flow without a paid Windows certificate, use
[manual updates](desktop-manual-updates.md) and select `delivery: manual-download`.
The signed Windows build described below is an optional formal release path.

This is the Windows certificate-store path for electron-builder **26.15.7**, the
repository's installed version. Keep the existing unsigned Alpha build unchanged.
The release path signs both the application executable and NSIS installer, uses
SHA-256 and an operator-selected RFC3161 timestamp service, forces signing, and
verifies the pinned publisher on both outputs. It does not fall back to unsigned
packages. See [electron-builder v26 signing](https://www.electron.build/v26/docs/features/code-signing/code-signing-win/)
and [Microsoft SignTool](https://learn.microsoft.com/windows/win32/seccrypto/signtool).

## Signing host prerequisites

- Native Windows x64, Node 24, locked desktop dependencies and the required package gates.
- A valid, trusted code-signing certificate with its private-key provider accessible
  from CurrentUser/My or LocalMachine/My. Supply only its public thumbprint to the
  scripts. Hardware-token/provider authentication remains with the operator.
- An approved RFC3161 timestamp URL. No password or private key is passed on a command line.
- A reviewed, clean main checkout with the desired unique product version, and the
  first-party updater configured with the same public trust pin used by publication.
  Do not overwrite the historical 2.0.10 installer. Prior unsigned installers cannot
  be used as the signed rollback artifact; build a separate signed prior-version package.
- An Ed25519 manifest signing key outside the repository, protected by the operator's
  account ACL. Pin its public key in the packaged updater. This key is independent
  of the Windows Authenticode certificate and cannot substitute for it.

## Build, prepare, publish

On the signing host set public configuration values, then run:

```powershell
$env:FUTURESTAFF_SIGNER_THUMBPRINT = '<approved certificate thumbprint>'
$env:FUTURESTAFF_TIMESTAMP_URL = '<approved RFC3161 timestamp URL>'
node scripts/build-signed-desktop-installer.mjs
node scripts/prepare-desktop-update.mjs 'D:/releases/local-release-config.json'
```

Use `desktop/update-release.example.json` as a non-secret local configuration
template. The preparation command verifies both installers before producing a
fresh directory containing the two immutable EXEs, signed `release.json`, public
`trust.json`, `SHA256SUMS` and a final `READY` marker. An incomplete directory without
READY is not publishable. No private signing key is copied into the bundle.

Transfer the complete verified bundle to the selected server over authenticated
transport. Run the publisher using an **independently pinned** operator trust file:

```text
node scripts/publish-desktop-update.mjs /opt/futurestaff/dev/update-bundles/2.0.11 /opt/futurestaff/dev/update-trust.json /opt/futurestaff/dev/desktop-updates
```

Paths and DEV origin above are examples until the operator selects a target.
The publisher verifies the envelope and every artifact hash, uses an exclusive
publication lock, preserves existing artifact names, rejects feed downgrade or
overwrite, and atomically switches the feed after both artifacts are present.
It never installs a certificate, changes system trust, edits Nginx/DNS, or uploads
without an operator-selected transport/target. Inspect stale locks and incomplete
artifacts manually rather than deleting them automatically.

The web server must map the selected HTTPS URL directory to this isolated static
webroot. Serve the mutable feed with `Cache-Control: no-store`; installers use
immutable versioned filenames. Keep private keys, local config, trust administration
files, and publication locks outside public URL routes. Upload publication tools
separately from the webroot. Nginx changes and live publication require the selected
environment's authorization and verified access.

## Live acceptance

Verify HTTPS feed and artifact paths without redirects, download and verify exact
SHA-256/length and publisher, then test an installed client upgrading from the
signed prior version and manually reinstall the prior signed artifact. Preserve
previous installers, application state and prior feed for recovery. This workflow
does not claim live acceptance from offline fixture tests.

As of 2026-10-08 this computer has no code-signing certificate in either My store,
no configured signing service and no usable `futurestaff-dev` SSH alias. The user
must select a certificate/service and a reachable publication target before real
signing or publishing can proceed.
