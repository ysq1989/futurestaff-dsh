# ADR-011: Package the Windows Runner with Node, WinSW, and Inno Setup

## Status

Accepted

## Context

Alpha users should install Local Runner without Node.js knowledge. A normal Node process does not implement the Windows service protocol, and a reusable installer must not contain a device credential.

## Decision

Build an x64 setup executable with Inno Setup. Bundle a pinned official Node.js 22 runtime and the production Runner dependency closure. Use stable WinSW 2 to register the Runner with Windows Service Control Manager. Enrollment exchanges a short-lived one-time code for a per-device credential after installation.

The first artifact is unsigned and private. Public distribution requires a separate code-signing decision.

## Consequences

- The package is larger than a native single executable but uses the same tested JavaScript runtime as development.
- Node and WinSW versions and checksums become reviewed supply-chain inputs.
- Service lifecycle and rolling logs are delegated to a mature Windows service adapter.
- Enrollment must be implemented before the installer is suitable for another user's computer.
