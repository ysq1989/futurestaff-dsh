# Agent PC Product Hub approval UI

Status: desktop authorization, live draft/approval client, and DSH Profile mounting implemented locally; rebuilt installer smoke pending.

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
- Tokens are supplied by the platform-access Host broker and are never persisted by this package.
- A valid `?draft=<uuid>` enters the live desktop flow. The client derives the active tenant and Product Hub base URL only from the strict credential-free Host snapshot, revalidates both before every token mint, and fails closed after tenant or application changes.
- Only server-issued `product_hub.operator` or `product_hub.admin` capability enables approval in the UI. Product Hub remains the final authorization authority.
- The `state=` fixtures remain available only for disconnected visual acceptance and never enter the live request path.
- The DSH integration uses the additive `sidebar.footer.action` and `shell.overlay` slots. It does not replace the official sidebar, conversation, or details occupants.
- Built UI assets are served only from the fixed loopback `/_futurestaff/product-hub-ui` prefix with a restrictive CSP, no referrer, no cache, and MIME sniffing disabled.
- No change is made to the pinned DeepSeek Harness checkout or the generic desktop shell.

## Responsive direction

Desktop uses a product-preview region beside a compact approval panel. Below 980px the panel becomes a single column, and below 640px products become compact horizontal rows with a full-width action area.
