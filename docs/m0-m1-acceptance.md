# M0/M1 acceptance criteria

## M0

- [x] Repository is independent and is not a GitHub fork.
- [x] DSH is a pinned upstream runtime dependency, not vendored source.
- [x] Profile composes official base and Web bundles.
- [x] `profile:dump` can resolve the final plugin tree after installation.
- [x] Docker binds the Web surface to host loopback by default.

## M1

- [x] `fs-core` is mounted as an out-of-tree Cordis plugin.
- [x] Tenant, user, and optional device identifiers are validated and passed through.
- [x] Tool metadata covers cloud/local execution, approval, tenant scope, and device selection.
- [x] Contract tests cover invalid identity and invalid cloud/local combinations.
- [x] Selection Center and Vietnam Visa directories contain no business implementation.

## Manual smoke test

1. Set real provider credentials in `.env`.
2. Run `npm run profile:install` and `npm run profile:dump`; verify `futurestaff-core` is present.
3. Run `npm run dev -- --port 3080 --no-open`.
4. Open `http://127.0.0.1:3080`, start a conversation, and receive a model response.

On managed Windows machines, application-control policy may block DSH's native `sharp` binary. This is an environment restriction, not a Profile resolution failure; use the Linux container path or allow the signed native module. The configuration-tree check remains platform-neutral.
