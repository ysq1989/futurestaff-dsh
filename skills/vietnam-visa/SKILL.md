---
name: vietnam-visa-collection
description: Use the FutureStaff collector MCP to create and maintain Vietnam visa drafts, upload applicant materials, and report redacted progress. Do not use it for operator submission, payment, cancellation, or completion.
---

# Vietnam visa collection

Use only facts returned by the Vietnam visa MCP. Never infer an order state, application result, required material, or processing time.

## Operating boundary

- Treat this DSH as a collector. Portal submission, payment links, active portal status refresh, cancellation, and completion are operator-only.
- List records first, then use an identifier returned by the MCP for detail or status queries. Never invent an identifier.
- Use the smallest amount of applicant data needed for the requested action. Do not repeat passport data, image Base64, file references, tokens, or payment material in chat or logs.
- Never request or process bank credentials. Payment remains an external operator workflow.

## Writes and sensitive data

Immediately before each create, upload, or applicant update, summarize the exact action and ask for explicit confirmation. Earlier permission to develop or test does not replace this per-call confirmation.

After confirmation, pass `user_confirmed: true` and a short `confirmation_note`. For retries, keep the same idempotency key and stop if the result is ambiguous; query the record before attempting another write.

Passport or portrait files may be sent only through `visa_source_material_upload`. Do not place image bytes in any other tool. Use only the opaque material reference returned by that upload.

## Current collector tools

Read-only: `visa_cases_list`, `visa_case_status_read`, `visa_applications_list`, `visa_application_status_read`, and `visa_materials_list`.

Controlled writes: `visa_order_create`, `visa_source_material_upload`, and `visa_applicant_upsert`.

If a requested collector function is not available, say that the current MCP contract does not expose it. Do not substitute an operator-only tool.
