# Current Atomic Task

## B02q: Skip generic Setup for the product Profile

- Status: implementation and full desktop verification complete locally; no commit or installer rebuild yet.
- Goal: automatically apply the locked-down FutureStaff desktop defaults and reach the platform login gate without asking ordinary users to configure DSH window, market, notification, browser, or network options.
- Acceptance: `futurestaff-alpha` never opens the generic Setup Wizard, persists the product defaults and completion marker, and leaves every other Profile's interactive Setup behavior unchanged.
- Boundaries: no authentication weakening, model/provider configuration exposure, push, deployment, signing, distribution, or installer execution.
