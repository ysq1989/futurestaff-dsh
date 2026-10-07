# FutureStaff desktop updates V1

Owner: the embedded product desktop shell. Windows x64 only; no business data,
tenant API, session token, database change, or upstream Harness modification.
The first-party `futurestaff-updates` plugin owns the existing local update-check
route and version/tray actions. The legacy `desktop-updates` plugin stays disabled.

## User flow

- Use the version button in the extended titlebar or **Check for updates** in the tray.
- Missing release configuration produces an explicit notice without a network request.
- A configured packaged app checks once after one minute and every six hours.
  Background checks only notify; they never download or install.
- A manual check reports the installed/latest version or shows release notes and
  asks to download. After verification, a second confirmation launches the
  existing Windows installer flow and quits the current desktop. Choosing later
  removes the downloaded installer; users can check again when ready.
- Errors and invalid packages never start an installer. Developer and unsupported
  platform builds display an explanatory notice.

## Release configuration

Set the `futurestaff-updates` row in the desktop distribution's `cordis.patch.yml`:

```yaml
manifestUrl: https://updates.fsstory.net/stable.json
publicKey: |
  -----BEGIN PUBLIC KEY-----
  <release operator's Ed25519 SPKI public key>
  -----END PUBLIC KEY-----
signerThumbprint: <40 hexadecimal characters of the approved Windows signing certificate>
background: true
```

The URL above is an example, not a provisioned service. Defaults are empty and
perform no network access. Source configuration belongs to the release operator;
renderer requests accept only an empty body, never a source URL, path or key.
Keys and certificate pins are public verification data. No signing private key
belongs in a Profile, feed, repository, renderer or application environment.

## Signed release contract

The HTTPS response is an envelope `{ "payload": "<JSON string>", "signature":
"<base64 Ed25519 signature>" }`. Sign the **exact UTF-8 bytes** of `payload`.
The payload shape is:

```json
{
  "schemaVersion": 1,
  "productId": "net.fsstory.agent.desktop",
  "platform": "win32",
  "arch": "x64",
  "version": "2.0.11",
  "notes": "Release notes",
  "installer": { "url": "https://updates.fsstory.net/2.0.11.exe", "size": 123, "sha256": "<64 lowercase hex>" },
  "rollback": { "version": "2.0.10", "url": "https://updates.fsstory.net/2.0.10.exe", "size": 123, "sha256": "<64 lowercase hex>" }
}
```

Only HTTPS `fsstory.net`/subdomains are allowed. Artifact origins must equal the
manifest origin; redirects, credentials, query strings and alternate ports are
rejected. Publish artifacts directly at immutable paths. The 32 KiB manifest,
bounded notes, canonical stable SemVer, product/platform/architecture, exact
installer size (at most 1 GiB), SHA-256 and older rollback reference are validated.
Downloads use a unique application-private directory, fail closed on hash or
Authenticode mismatch, and recheck both bytes and publisher immediately before launch.
Normal updates cannot downgrade. Recovery is an operator-controlled installation
of the retained previous signed release; V1 does not automatically roll back a
failed installer or verify rollback URL availability during routine checks.

## Release and acceptance boundary

Offline tests cover real Ed25519 signatures, tampering, trust scope, stream bounds,
integrity, publisher-check failures, cancellation and cleanup. Live acceptance
requires an operator-provided HTTPS feed, pinned public key and certificate,
two signed installers, an installed Windows test client, and testing successful
upgrade plus manual rollback. Existing unsigned private Alpha installers are
intentionally ineligible. Feed publication, signing setup, installation, commit,
push and deployment remain separately authorized operations.
