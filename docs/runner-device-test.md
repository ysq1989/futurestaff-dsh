# First real Runner device test

On 2026-08-28, a Windows development computer was enrolled as the first real Local Runner.

Verified outcomes:

- The raw device token remained in the ignored local client environment file.
- The server received only the digest binding through a read-only mount.
- The opt-in Gateway became healthy on server loopback port 3090.
- Nginx accepted the exact TLS WebSocket route while retaining Basic Auth for the DSH web route.
- The Windows client authenticated, registered its exact binding, and remained connected across heartbeat intervals.
- No Runner protocol rejection or disconnect event occurred during the test window.

Not yet verified through the deployed control plane: cloud-triggered `local.system_info`. The current Gateway deliberately has no DSH dispatch adapter; that is the next milestone.
