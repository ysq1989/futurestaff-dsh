# Vietnam Visa MCP boundary

M4.1 mounts the existing authenticated Streamable HTTP server at
`VISA_ASSISTANT_MCP_URL`. This directory records the discovered contract; it does
not proxy credentials or fork the upstream implementation.

## Discovered on 2026-08-29

Collector reads:

- `visa_cases_list`
- `visa_case_status_read`
- `visa_applications_list`
- `visa_application_status_read`
- `visa_materials_list`

Collector writes requiring per-call approval:

- `visa_order_create`
- `visa_source_material_upload`
- `visa_applicant_upsert`

Operator-only tools denied by a collector Profile:

- `visa_application_submit`
- `visa_application_payment_link`
- `visa_case_query_status`
- `visa_application_query_status`
- `visa_case_cancel`
- `visa_case_complete`

Unknown future tools are denied until classified. The current server does not
yet expose the M4 target tools for product discovery, review submission,
correction response, collector application-count reporting, or document status.
