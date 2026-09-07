# Completed Atomic Tasks

## B01a: Connect the desktop product to the pinned local platform Mock

- Status: Completed and pushed as `71174081fbbcd377f61c0abf4fb1874de84199ce`.
- Contract: `0.1.0`, platform commit `93ca162566225894a8cd317b7bc51b096d16a0ec`, bundle SHA-256 `5ae4e07157b5c7c1b8007f514d47cc0bb05734841341f59c44c37a978b7f9fe9`.
- Result: login, refresh, logout, tenant discovery/switching, authorized applications, explicit state rendering, and tenant-change isolation run against the loopback-only Mock.
- Verification: 11 focused plugin tests, full product check, local Mock smoke, visible browser flow, Profile installation, and exact diff review passed.
- Known follow-up: the pinned DSH `0.1.1-rc.2` `pnpm dlx` launcher could not resolve its declared `dsh-app-boot` dependency on this Windows host.
