# futurestaff-dsh

FutureStaff's upgrade-friendly extension layer for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). This repository does **not** fork or patch DSH Core. It composes the official Web bundles in a custom Profile and mounts out-of-tree plugins beside them.

## Scope

- **M0:** boot the official DSH Web surface through `futurestaff-alpha`.
- **M1:** mount `fs-core`, expose validated FutureStaff identity context, and standardize Tool execution metadata.
- **M2:** a contract-first Selection Center MCP with four Tools and an isolated provisional HTTP adapter.
- **Not in scope:** Vietnam visa business calls, Local Runner, auth, billing, and production deployment.

## Quick start

Requirements: Node.js 22+, npm, and pnpm (DSH uses pnpm for plugin management; `pnpm dlx` also avoids npm's slow prerelease dependency resolution).

```bash
npm install
cp .env.example .env
npm run check
npm run profile:install
npm run profile:dump
npm run dev -- --port 3080 --no-open
```

On PowerShell, use `Copy-Item .env.example .env` instead of `cp`. The installer stages the committed Profile under `$DSH_HOME/profiles/futurestaff-alpha`; source files remain in this repository.

If Windows Application Control blocks DSH's native `sharp` module, run the Docker setup on a Docker-capable host. The Profile can still be verified with `npm run profile:dump`.

## Commands

| Command | Purpose |
|---|---|
| `npm run check` | Type-check, test, and build all implemented workspaces |
| `npm run profile:install` | Stage the custom Profile and install `fs-core` |
| `npm run profile:dump` | Print the final composed DSH plugin tree |
| `npm run dev -- --port 3080 --no-open` | Start the FutureStaff Alpha Web Profile |

## Structure

```text
profile/futurestaff-alpha/  Custom Profile source
plugins/fs-core/            Identity context and Tool metadata contract
mcp/selection-center/       M2 MCP server, schemas, and HTTP adapter
mcp/vietnam-visa/           Future boundary placeholder
skills/jade-sourcing/       Future skill placeholder
skills/vietnam-visa/        Future skill placeholder
docs/                       Architecture, acceptance criteria, conventions, ADRs
docker/                     Development container baseline
scripts/                    Profile staging utility
```

The Selection Center row is automatically disabled until both
`SELECTION_CENTER_BASE_URL` and `SELECTION_CENTER_API_KEY` are configured.

See [architecture](docs/architecture.md), [M0/M1 acceptance](docs/m0-m1-acceptance.md), [M2 acceptance](docs/m2-acceptance.md), and [development conventions](docs/development.md).

## Upgrade policy

The DSH version is pinned in scripts and Docker for reproducibility. Upgrade it deliberately, run `profile:dump`, compare the resulting tree, and run the full check. Do not copy or edit DSH Core files.
