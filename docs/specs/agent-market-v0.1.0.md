# Platform role market 0.1.0

Owner: platform Agent templates; consumer: FutureStaff DSH product layer.
UI uses existing DSH theme tokens and Settings slots, with a platform catalog,
search/category filter and local-role list. Native Preset picker/header remain
the execution entry. No third-party market or upstream Core modifications.

`GET /desktop/v1/agent-templates` uses the existing desktop bearer credential
on a pinned environment origin. Server-derived tenant module filtering applies.
Envelope: `contractVersion`, `activeTenantId`, `items`.
Each item: `templateId`, `version`, `name`, `description`, `icon`, `category`,
`capabilityBullets`, `instructions`, `skills`, `compatible`, `unavailableReason`.
Version is SHA-256 of UTF-8 JSON with sorted keys, no whitespace, excluding
version itself. Only builtins are exposed. Empty skill lists are supported in
this slice; platform-specific skills/MCP/tool recipes are unavailable.

Host keeps bearer credentials private. Loopback routes require the non-simple
`X-FutureStaff-Market: 1` header: catalog/mine GET and install POST. Install accepts
only templateId/version and refetches the authoritative catalog; stale versions
are refused. Renderer receives display metadata only, no instructions or tokens.
Adding a role explicitly makes that version the native default for new sessions,
which refreshes the native picker through the existing settings event. Started
sessions remain unchanged. Users can select another role in the native picker.

Storage: existing environment/tenant/user workspace `agent-presets/`.
Preset ID `fs-<template UUID>-<content hash>`; immutable snapshot and trusted
standard composition plus a fixed role plugin. DSH tools/project instructions
stay in place. Native default-role preference becomes user-editable; model and
other managed settings stay controlled. Role roots are read-only to the native
authoring API; existing workspace Profiles receive an additive versioned patch
at login. No user history is copied or deleted.

Updates add a new version and preserve old IDs for session restoration. File
memory paths in adapted templates remain project-scoped; no independent role
memory service or scheduled heartbeat is implemented. Official Harness registry
adapter, additional business Skills, personal role editing and visual desktop
acceptance are subsequent work. This version uses the current file Preset seam.

Release/deployment, installed Profile update and actual account smoke testing
are separate authorized operations. Revert the product routes and composition
to disable the feature; retain snapshots for existing session references.

Desktop 2.0.15 upgrades the complete access library in existing identity Profiles
only if every installed file matches the audited 2.0.14 inventory. Replacement
uses a staged directory and rollback on rename failure. Customized libraries
are preserved, preventing a new browser client from pairing with an old Host.
Identity composition, protected credentials and session files are not replaced.
