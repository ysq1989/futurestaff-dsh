# Agent PC Product Hub approval UI

Status: local visual slice implemented and browser-verified; desktop session wiring pending.

## Goal

Let an authenticated FutureStaff Agent PC user verify a server-owned Product Hub selection draft and explicitly approve publication without treating the Agent's recommendation as consent.

## Interaction contract

- Display the draft title, description, server expiry, selected count and buyer-facing product facts.
- Let the user choose only a safe Product Hub template and edit the publication title.
- Keep the approval action disabled for expired drafts, read-only users, empty titles and in-flight requests.
- State clearly that approval creates an immutable release, runs platform review and may publish a customer-facing H5.
- Show loading, empty, error, expired, read-only, submitting, rejected, superseded and published outcomes.
- Open only the public URL returned by Product Hub after a `PUBLISHED` result.

## Boundary

- The UI never accepts or sends tenant identifiers, product facts, publication state, HTML, CSS or JavaScript.
- Tokens are supplied by the future platform-session adapter and are never persisted by this package.
- This slice uses a typed client boundary and local fixtures. Wiring the platform login session into the desktop host remains a separate task.
- No change is made to the pinned DeepSeek Harness checkout or the generic desktop shell.

## Responsive direction

Desktop uses a product-preview region beside a compact approval panel. Below 980px the panel becomes a single column, and below 640px products become compact horizontal rows with a full-width action area.
