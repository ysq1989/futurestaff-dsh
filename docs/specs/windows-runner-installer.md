# Spec: Windows Local Runner installer

## Objective

Produce a guided Windows 10/11 x64 installer for FutureStaff Local Runner. The user installs one background service, enters a device name and a short-lived one-time enrollment code, and does not install Node.js or handle a long-lived device token.

## Tech stack

- Existing TypeScript Runner client and protocol workspaces.
- Official Node.js 22 Windows x64 runtime, pinned and checksum-verified during packaging.
- WinSW 2 stable as the Windows Service Control Manager adapter.
- Inno Setup 6 for the signed-ready setup executable.

## Commands

- Unit and repository checks: `npm run check`
- Build installer payload: `npm run package:runner:windows`
- Compile installer: `npm run installer:runner:windows`
- Verify installer artifact: `npm run verify:runner:windows`

## Project structure

- `runner/installer/windows/` — build scripts, Inno source, service template, and tests.
- `runner/client/` — enrollment-aware Runner executable logic.
- `runner/gateway/` — one-time code redemption boundary.
- `dist/runner-windows/` — ignored staging output.
- `outputs/` — ignored compiled installer output.

## Code style

Packaging logic is deterministic JavaScript with explicit inputs and validated outputs. Generated configuration is never interpolated through a shell command. Example:

```js
await stageRunnerPayload({ sourceRoot, outputRoot, nodeArchive, winSwBinary })
```

## Testing strategy

- Small tests validate manifests, templates, path handling, and secret exclusion.
- Medium tests launch the staged Runner with a loopback Gateway.
- Windows acceptance installs, starts, reconnects, and uninstalls the service on the current computer.
- The full repository check remains the merge gate.

## Boundaries

- Always: pin third-party versions and hashes; run as a restricted service identity; roll logs; redact codes and tokens.
- Ask first: public release, code signing certificate use, or support for another operating system/architecture.
- Never: embed device credentials in the installer; log enrollment codes/tokens; expose enrollment administration publicly; grant arbitrary local execution.

## Success criteria

- One `.exe` installs without a preinstalled Node.js.
- Installed service starts automatically and survives reboot/service restart.
- Installer contains no tenant, user, device token, API key, or enrollment code.
- A one-time code can be redeemed once and expires; replay fails closed.
- The service connects to `dsh.fsstory.net` and executes only `local.system_info`.
- Uninstall removes the service and application; local credentials are removed only when the user explicitly selects that option.

## Observability questions

1. Did installation, enrollment, service start, and connection succeed?
2. If enrollment failed, was it invalid, expired, consumed, or unreachable?
3. Is the service repeatedly restarting or failing to reconnect?

Events use structured JSON and stable reason codes. Codes, tokens, tenant IDs, user IDs, and hostnames are excluded from installer and enrollment logs.

## Open questions

Code signing and public distribution are deliberately deferred. The first artifact is an unsigned private Alpha installer for this computer.
