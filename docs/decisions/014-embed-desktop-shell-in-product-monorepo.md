# ADR-014: Embed the desktop shell in the FutureStaff product repository

## Status

Accepted

## Date

2026-09-08

## Context

The FutureStaff product Profile and plugins lived in `futurestaff-dsh`, while the
Electron host, installer UI, and Windows packaging lived in
`futurestaff-dsh-desktop`. A release therefore depended on two mutable working
directories and an extra release-commit pin. That split allowed a technically
valid installer to be built with an older Profile or without the agreed
installer UI.

The desktop shell and product runtime are one client release unit. They do not
need independent teams, release cadence, scaling, fault isolation, or compliance
boundaries. The official `deepseek-harness` source still requires a strict
read-only upstream boundary.

## Decision

`futurestaff-dsh` is the authoritative client monorepo. The controlled desktop
history is imported at `desktop-shell/`; its package boundaries and Yarn
workspace remain intact. Product plugins continue to use the root npm workspace.
The official Harness checkout remains an unmodified Git submodule at
`desktop-shell/deepseek-harness`.

Desktop verification and Windows packaging resolve only the embedded path. They
must not read an adjacent checkout or a `FUTURESTAFF_DESKTOP_SHELL_DIR` override.
One root commit therefore identifies the product code, desktop host, installer
UI, Profile migration rules, and packaging scripts used for a candidate.

The former `futurestaff-dsh-desktop` repository becomes read-only migration
history after the merged repository is reviewed and pushed. It is not deleted by
this change.

## Consequences

- `npm run build` builds both the product packages and embedded desktop shell.
- `npm run check` runs product and desktop gates from one repository.
- `npm run installer:windows` stages and packages only `desktop-shell/`.
- npm and Yarn lockfiles remain separate because they govern separate workspace
  roots; merging repositories does not flatten package ownership.
- platform authentication, tenant authorization, model credentials, and business
  data ownership are unchanged.
- rollback is a single monorepo commit. The legacy desktop repository remains
  available until the merged main branch and installer are accepted.

## Alternatives considered

- Keep two repositories and strengthen the SHA lock: rejected because it still
  permits release coordination drift and duplicates repository lifecycle work.
- Flatten every package into one workspace: rejected because it would couple the
  upstream desktop toolchain to product plugins without a product benefit.
- Copy the official Harness source into the monorepo: rejected because it would
  lose the auditable, unmodified upstream gitlink boundary.
