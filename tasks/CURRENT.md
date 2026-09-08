# Current Atomic Task

## B02p: Merge the product and desktop repositories

- Status: completed locally by merge/import commit `f6b685b888` and integration commit `358f194f93`; artifact evidence is recorded in version control.
- Goal: make `futurestaff-dsh` the single authoritative repository while preserving the desktop package boundary and the exact upstream Harness gitlink.
- Acceptance: one-root foundation verification, product and desktop checks, and a Windows installer built from `desktop-shell/` without an adjacent repository dependency.
- Boundaries: no push, deployment, signing, distribution, installer execution, legacy-repository deletion, or production mutation.
