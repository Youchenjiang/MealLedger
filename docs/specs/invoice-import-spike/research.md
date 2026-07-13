# Invoice Import Spike Research

## Sources Reviewed

- [Official Electronic Invoice Application API Specification v2.1](https://www.einvoice.nat.gov.tw/static/ptl/ein_upload/download/5160.pdf)
- [Official API Traffic Control Notice](https://www.einvoice.nat.gov.tw/static/ptl/ein_upload/download/5540.pdf)
- [Official API Use Regulations](https://www.einvoice.nat.gov.tw/static/ptl/ein_upload/download/13.pdf)
- [Official API Application and Self-check Form](https://www.einvoice.nat.gov.tw/static/ptl/ein_upload/download/5220.pdf)

## Confirmed Findings

### Application and Trust Boundary

The official API requires a developer or vendor application process. After
approval, the applicant receives an `AppID` and `APIKey`; some requests require
an APIKey-generated signature. The API is HTTPS POST with JSON responses, and
the specification lists a separate test endpoint. API keys must not be exposed
to the browser or bundled into the PWA.

### Available Consumer Queries

The specification lists consumer-oriented endpoints for invoice headers,
invoice details, carrier invoice headers, carrier invoice details, and querying
the carriers linked to a mobile barcode. The carrier invoice header query
accepts a carrier type, masked carrier number, validation value, date range,
and optional page number.

The documented carrier header response includes invoice number, seller name,
invoice status, amount, invoice period, seller business number, invoice time,
currency, donation marker, and date/time components. The detail response can
include description, quantity, unit price, and line amount. A business or
organization buyer may receive reduced detail fields, so this must remain an
explicit adapter condition rather than an assumed invariant.

### Query Limits and Failure Modes

The API specification documents response code `996` when the result count is
over the limit and instructs the caller to narrow the date range or continue
with carrier pagination. The traffic notice limits each AppID to 1,500
requests per 10 seconds. For several repeated queries with the same specified
parameters, the limit is 5 requests per 10 minutes, after which the platform
returns `429` and pauses that query for 10 minutes.

The adapter therefore needs bounded retry, exponential backoff, a persisted
cursor/watermark, and a user-visible sync status. It must never retry a bad
credential or invalid signature as if it were a transient network failure.

### Application, Consent, and Product Obligations

The official use regulations define the developer as a business, organization,
or government agency providing an electronic-invoice service to product users.
The application package requires an application/self-check form, an
undertaking, and evidence of a CNS 27001 or ISO 27001 information-security
standard. The application form says review takes approximately seven working
days. Approved authorization lasts for at most three years and requires
re-review before expiry.

The regulations require product-user consent for the service, the ability to
request stopping use or deletion of invoice data and usage records, and a new
consent every six months with an auditable trail. If the product provides
electronic-invoice querying, it must also provide cloud-invoice donation and
hide the last three characters of donated invoice numbers. Any use outside the
official electronic-invoice service scope requires additional notice and
renewed consent. The official self-check example also calls for user-facing
purpose, data type, period, region, recipient, method, and personal-data-rights
disclosures.

These are product and operational obligations, not merely backend fields. In
particular, a personal-only MealLedger deployment does not yet demonstrate that
it satisfies the official developer eligibility or security-certification
requirements.

### Dates and Historical Import

The carrier header API documents a bounded date interval and a page parameter.
The exact product-level historical range must be selected only after testing
the current endpoint behavior. The first implementation should use a small
initial window and allow an explicit backfill job rather than silently asking
for an unbounded history.

### What Is Not Yet Proven

The reviewed documents do not by themselves prove:

- that the current application review will approve a personal finance product
  operated by this project, especially if it is not represented by an eligible
  business or organization with the required security evidence;
- a consumer OAuth or consent redirect flow suitable for a browser product. The
  reviewed API documents carrier validation parameters, not a generic OAuth
  authorization flow;
- a webhook or push delivery mechanism;
- a sandbox account lifecycle and safe automated fixture dataset;
- the full retention and cross-border processing position needed for
  MealLedger's privacy notice and user consent copy;
- whether every carrier type has identical header/detail coverage.

These are blocking questions for a production adapter, not assumptions to be
filled in by implementation.

## Initial Assessment

**Conditional go for a scheduled-pull spike; no production go yet.** The official
API has enough documented read/query surface to justify an adapter experiment,
but the developer eligibility, security-certification, user-consent,
re-consent, donation, and retention obligations are now launch-blocking
questions. Its credential model, carrier validation flow, rate limits, and lack
of documented push behavior mean that the first technically viable design is
likely a server-side scheduled pull that creates source snapshots and review
drafts.

Dedicated invoice tables should remain deferred until the access review and a
safe fixture run confirm the required retention and line-item behavior.

For the current project, the safest default remains **manual scan/CSV import**.
Do not apply for or implement official synchronization until the project owner
confirms that the product will satisfy the developer, security, consent, and
donation obligations.
