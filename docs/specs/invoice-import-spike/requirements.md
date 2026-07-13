# Invoice Import Spike Requirements

## Status

Research-only spike. This specification does not add production invoice
synchronization.

## Goal

Determine whether the Taiwan Ministry of Finance e-invoice application APIs can
support a privacy-preserving, user-authorized import flow for MealLedger. The
spike must produce a `go`, `conditional go`, or `no-go` decision and a provider
adapter contract without coupling the ledger core to the provider API.

## In Scope

- Verify the official developer application and credential process.
- Verify how a consumer's mobile barcode/carrier data is authorized and
  validated.
- Verify invoice header and line-item availability, status fields, seller
  identity, amount, currency, invoice time, and carrier metadata.
- Verify query windows, pagination, response limits, rate limits, and retry
  behavior.
- Verify whether the official service provides polling only, push delivery, or
  a webhook-equivalent mechanism.
- Define provider-neutral adapter inputs, outputs, errors, and sync watermarks.
- Define privacy, credential, audit, and revocation requirements.
- Decide whether V2 needs dedicated `invoice_records` and
  `invoice_line_items`, or whether imported source payloads and drafts are
  sufficient for the first implementation.

## Explicit Non-goals

- No Ministry of Finance production API calls from the app.
- No frontend collection or storage of `APIKey`, carrier validation codes, or
  other provider secrets.
- No Supabase credential table or scheduled sync job in this spike.
- No invoice confirmation into official `ledger_records`.
- No automatic merchant/category classification.
- No bank, credit-card, or account-statement integration.
- No real personal invoice data in fixtures, screenshots, or the repository.

## Required Decision Gates

The spike is complete only when each gate has an evidence-backed answer.

1. **Access**: An approved developer application can call the required consumer
   endpoints, and the application terms allow a personal finance use case.
2. **User authorization**: The user can grant, rotate, and revoke access without
   exposing provider secrets to the browser. The documented API flow must be
   distinguishable from MealLedger's Supabase login.
3. **Coverage**: The service returns the minimum useful header fields and, when
   available, multiple line items. It must document behavior for voids,
   refunds, donated invoices, missing details, and business-buyer invoices.
4. **Incremental import**: A stable provider identifier, query watermark, or
   equivalent replay-safe strategy exists. If not, the adapter must define a
   bounded reconciliation strategy and remain draft-only.
5. **Limits**: Query range, page size, response count, rate limits, and error
   codes are known well enough to implement bounded retries and backoff.
6. **Delivery**: Push/webhook support is explicitly documented. Until then,
   the product design must assume scheduled pull and show the last successful
   sync time.
7. **Testability**: An official test endpoint, test account, or safe fixture
   procedure exists. If none exists, live integration remains a separately
   approved operation.
8. **Privacy**: Retention, cross-border processing, user deletion, credential
   revocation, and audit requirements are documented before implementation.

## Proposed Provider-Neutral Contract

The future adapter should expose these operations without leaking provider
field names into the core domain:

```text
authorize() -> provider authorization state
refreshAuthorization() -> active | expired | revoked | failed
listInvoices(cursor, dateRange) -> page<InvoiceEnvelope, nextCursor>
getInvoiceDetails(providerInvoiceId) -> InvoiceEnvelope
revokeAuthorization() -> revoked
```

`InvoiceEnvelope` contains provider identity, invoice date/time, seller
identity, total amount, currency, status, carrier reference, optional buyer
identity, optional line items, and the raw-source reference. It must retain the
provider response as source evidence only; it does not become an official
ledger record automatically.

## Import Boundary

The first production implementation, if the spike passes, should use this
pipeline:

```text
provider response -> source_payload -> invoice draft -> user review
                   -> optional transaction draft -> explicit confirmation
```

Provider records are immutable snapshots from the external service. Repeated
pulls must upsert by provider identity and never delete a previously imported
snapshot silently. A user-confirmed ledger record must keep a link to the
invoice source and remain independently editable under the existing audit and
idempotency rules.

## Decision Outcomes

- **Go**: all required gates pass; write a follow-up `invoice-import` spec and
  a provider adapter implementation plan.
- **Conditional go**: read access is possible but one or more limits require a
  narrow first release, such as scheduled pull, header-only import, or a fixed
  historical window. Record the limitation and acceptance criteria.
- **No-go**: the official service does not offer suitable personal read access,
  safe authorization, or acceptable testability. Keep manual scan and CSV
  import as the supported paths and do not add provider-specific schema.

