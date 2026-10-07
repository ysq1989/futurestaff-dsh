# ADR-016: Manual desktop update delivery without paid Windows code signing

Accepted 2026-10-08 following the user's explicit selection of a simpler update
flow. Extends ADR-015. The first-party default is now `manual-download`: check a
pinned Ed25519-signed feed, verify exact SHA-256/size, and reveal the downloaded
installer in its directory. The desktop does not execute the file, restart, quit,
disable Windows protections or install a trusted certificate. The user starts
installation themselves and may encounter Windows publisher/security prompts.

Only `signed-install` retains native installer execution, and its existing
Authenticode certificate pin and revalidation remain mandatory. A feed cannot
select an execution mode; delivery is a local distribution configuration. Legacy
third-party updates remain disabled. No paid CA account or certificate purchase is
needed for manual delivery; manifest-signing keys remain protected release inputs.

The publisher may prepare unsigned installer bytes only when explicitly selecting
manual delivery. Signed installation preparation remains fail-closed by default.
Both delivery paths preserve approved HTTPS origins, manifest signatures, bounded
streaming, version/rollback metadata, immutable artifacts and atomic publication.

This supplements the platform ADR-0034 distribution boundary with a download-only
path; it does not permit unsigned automatic execution. Signing and renewal of a
Windows publisher certificate is deferred until a formal distribution requires it.
