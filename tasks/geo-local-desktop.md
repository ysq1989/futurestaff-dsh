# GEO desktop migration

User confirmed local business UI/data with DSH platform login and authorized models,
and a GEO system entry at the same level as Douyin acquisition. Source baseline:
GEO aa8f810a80372e9bc14415b584504a5acf68b323; client 087e936df5aa.
Specification: docs/specs/geo-local-desktop-migration.md.

Preserve the uncommitted login workspace prompt improvement and both upstream pins.
Do not touch GEO production, import real data, send paid inference, publish articles,
update the installed app, commit or push without explicit authorization.

- [x] Fixed-source business migration with provenance and packaged assets.
- [x] Embedded persistent database; identity/permissions and per-member isolation.
- [x] Complete local brand/project/evidence/content/manual-publication workflows.
- [x] Authorized model adapter, explicit actions and unknown-result idempotency.
- [x] Peer GEO system launcher/page; login expiry and page lifecycle coverage.
- [x] Profile staging/new-and-existing workspace upgrades and release resources.
- [x] Headless business, denial, persistence and browser checks plus scoped builds.

Previous system browser work remains recorded in tasks/system-browser-tabs.md;
this migration does not implement an arbitrary-site browser or real Douyin sends.

Validation: GEO 7 focused tests with business/denial/persistence/unknown-result assertions;
Platform access 147 tests; root 64 tests (including GEO Profile resources);
stable/Beta Profile service 13 tests each; product/access and stable/Beta desktop
typecheck/build; real isolated browser peer launcher/tab/logout/narrow-layout smoke;
Electron Node PGlite create/reopen; runtime closure verified.
The existing stable/Beta source-drift gate still has the same nine failures.
No complete desktop-suite or installer-release pass is claimed.
Real Platform GEO permission availability and paid model results were not exercised.

2026-10-10: User authorized a local commit and a new test installer, with no push
or publication. Stable desktop version is 2.0.22, preserving the old 2.0.21 artifact.
Precommit `npm run check` was attempted: workspace type checks passed, but the
existing Douyin real-browser UI test timed out after 30 seconds and did not exit;
the check was stopped. The separate stable/Beta drift check retains exactly the
same nine failures. These gates were not disabled or widened.
Windows installer checks and artifact verification run separately during packaging.
Installed-software changes, push and publication remain unauthorized.
