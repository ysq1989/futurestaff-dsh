# ADR-017: Product-owned desktop preferences

Accepted 2026-10-08 following the user's request to remove configuration choices.
The FutureStaff distribution fixes enhanced layout, Windows Mica with OS capability
fallback, no plugin market, all four generic notifications, browser access off and
loopback-only networking. All profiles, including authenticated generated workspace
names, use these defaults on every launch; version/profile changes no longer ask
users to repeat the Setup Wizard.

The trusted launcher supplies immutable preferences to the Host. Settings namespace
validators reject conflicting writes, Market selection rejects enabling a provider,
and the native mode action rejects changes. The Desktop settings section, frame mode
picker and tray mode toggle are withdrawn from the normal FutureStaff client.
Other settings such as theme/language, account identity and business authorization
remain outside this policy. Scope is desktop-owned code; the Harness stays untouched.

Recovery Safe Mode remains isolated and uses its existing compatibility/opaque
window with notifications off. This recovery mechanism does not become a normal
user preference. Generic upstream/Beta adapters without a launcher policy retain
their existing behavior.
