# Desktop access appearance and local login hints

Requested 2026-10-08: blue-white desktop/access UI, no visible production endpoint
label, and account/subject selection memory. This explicitly overrides the default
dark presentation for this desktop surface through its existing public theme seam.

Only successful account identifiers and subject UUIDs offered by the validated server snapshot are stored
as local browser preferences. Subject hints are keyed by server user UUID and
preselect only subjects still offered by the current validated snapshot. Selection
still requires explicit confirmation and normal server membership checks. Passwords,
tokens, roles, permissions and authorization are never persisted as form hints.
Logout/expiration keep harmless form hints; existing session cleanup and workspace
isolation remain unchanged. Blocked or malformed storage cannot prevent login.

The appearance layer migrates the old dark default to light once using a new
marker, keeps subsequent explicit theme choices, and maps both schemes to blue
accent tokens. No upstream styles, business APIs or production configuration change.
The 2.0.14 release includes the reviewed access/workspace prerequisites needed by
subject selection, while excluding unrelated pending business modules.
