# Spec: Vietnam Visa multi-tenant collection and operations

## Objective

Build the first usable Vietnam visa workflow for FutureStaff. A management tenant represents one independent visa service provider with its own Vietnam portal account and future payment configuration. Each management tenant can create multiple collectors. Collectors use either a DSH conversation or a visual order workbench against the same business data.

The first production tenant is operated by FutureStaff itself. The design must support additional independent service providers without changing tenant ownership or authorization semantics.

## Validated assumptions

1. `operatorTenantId` identifies one management tenant / visa service provider.
2. A management tenant owns its portal credentials, products, collectors, applications and files.
3. A collector belongs to exactly one management tenant and cannot move between tenants.
4. External AI clients receive collector credentials and can never invoke operator or platform operations.
5. DSH and the visual collector workbench are two clients of the same collector API; neither owns a separate copy of an order.
6. One order may contain multiple applicants. Quantity reporting counts visa applications (`applicationCount`), not only orders.
7. Current payment is completed manually by an operator using a payment link or QR code. The system does not collect payment credentials or connect a bank account.
8. Customer collection, upstream-payment accounting and platform-fee ledgers are outside M4. Only application quantities per collector are reported.
9. Portal submission, payment completion, rejection, cancellation and final delivery remain operator-only actions.

## Roles and isolation

| Role | Scope | Allowed actions |
|---|---|---|
| Platform admin | Platform | Provision/suspend management tenants and audit platform usage |
| Operator | One management tenant | Manage collectors/products, review materials, submit to portal, expose payment link/QR, record payment completion, deliver result |
| Collector staff/AI | One collector | Quote products, create draft orders, collect applicant data/files, submit for review, answer material requests, query progress/results |
| Customer | Own applications | Future direct-consumer collector mode; access only own records |

Authorization derives `operatorTenantId`, `collectorId`, actor and role from authenticated credentials. Model-authored input must never select or override those fields.

## Workflow

```text
DRAFT -> WAITING_FOR_MATERIALS -> READY_FOR_REVIEW -> UNDER_REVIEW
      -> NEEDS_CORRECTION -> READY_FOR_REVIEW
      -> APPROVED_FOR_SUBMISSION -> SUBMITTED -> PAYMENT_REQUIRED
      -> PROCESSING -> ISSUED | REJECTED | CANCELLED
```

Collector operations end at review submission and correction responses. Only an operator advances an application through portal submission, payment and terminal states. Payment material is an access-controlled link or QR representation; credentials are never returned.

## Collector MCP v1

Read tools:

```text
visa_list_products
visa_get_product_requirements
visa_list_orders
visa_get_order
visa_get_order_status
visa_list_required_documents
visa_get_document_status
visa_list_order_events
visa_get_collector_stats
```

Controlled writes:

```text
visa_create_order
visa_update_applicant
visa_create_document_upload
visa_remove_unsubmitted_document
visa_submit_for_review
visa_answer_material_request
```

Every write requires explicit user approval. Sensitive applicant data is transmitted only after explicit authorization. File bytes use a short-lived upload URL; MCP messages reference `documentId`.

## Operator boundary

Operator capabilities use a separate authenticated route and credential set:

```text
/operator/collectors
/operator/products
/operator/orders
/operator/orders/{orderId}/review
/operator/applications/{applicationId}/submission
/operator/applications/{applicationId}/payment-instruction
/operator/applications/{applicationId}/result
/operator/reports/collector-application-counts
```

Payment instructions support `LINK` and `QR_CODE`. Recording completion is a deliberate operator action and does not prove bank settlement.

## Stable ownership and reporting

```ts
type VisaOrder = {
  orderId: string
  operatorTenantId: string
  collectorId: string
  customerId?: string
  status: VisaOrderStatus
  applicationCount: number
  createdAt: string
  updatedAt: string
}

type CollectorApplicationCount = {
  collectorId: string
  from: string
  to: string
  totalApplications: number
  submittedApplications: number
  issuedApplications: number
  rejectedApplications: number
  cancelledApplications: number
}
```

Every application, document, event and report row carries `operatorTenantId`; collector-created records also carry `collectorId`. No currency, revenue, cost, commission or settlement fields enter M4.

## Commands and structure

```text
Install: npm ci
Focused tests: npm test -w @futurestaff/vietnam-visa-mcp
Full verification: npm run check
Profile inspection: npm run profile:dump
Development: npm run dev
```

```text
mcp/vietnam-visa/          Collector MCP boundary
skills/vietnam-visa/       DSH operating instructions
plugins/fs-core/           Approval enforcement
profile/futurestaff-alpha/ Remote MCP mounting
docs/specs/                Living contract
docs/decisions/            Architecture decisions
```

The visual workbenches belong to the FutureStaff platform application. This repository owns the DSH profile, MCP connection, approval boundary and contracts.

## Testing strategy

- Small tests cover schemas, tool metadata and approval classification.
- Medium tests prove authenticated identity cannot be replaced by model input.
- Contract discovery classifies the existing remote MCP before binding names.
- Deployment verifies one collector can query only its own test records through DSH.
- Negative tests prove cross-tenant, cross-collector and operator attempts fail closed.

## Boundaries

- Always: derive identity from authentication, redact sensitive data, audit mutations and approve collector writes.
- Ask first: persistence schema, production customer data, portal automation, bank/payment-provider integration or public C-end launch.
- Never: expose operator credentials, put passport bytes in chat logs, accept tenant identity from tool arguments or collect payment credentials.

## M4.1 success criteria

- The existing collector MCP is enumerated and classified.
- FutureStaff Alpha mounts only the collector MCP with a server-side token.
- `fs-core` approves every write and fails closed on unknown visa mutations.
- DSH lists products, creates one approved test draft, queries status and reads collector application counts.
- The same record is visible to the collector workbench data source.
- Cross-tenant and operator capabilities are inaccessible.
- Full checks pass with no secret in Git or logs.

## Deferred

Customer payments, financial ledgers, bank/payment-provider integration, automatic payment, portal browser automation, platform service-fee billing and public C-end checkout.

## Implementation gate

Confirm that M4.1 may use the existing `dev.fsstory.net` collector MCP and test records for end-to-end verification.
