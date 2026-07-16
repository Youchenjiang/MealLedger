# Invoice Import Spike Tasks

## Research

- [x] Locate the current official application API specification.
- [x] Record developer application, AppID, APIKey, signature, HTTPS, and test
      endpoint requirements.
- [x] Record header, detail, carrier, date-range, and pagination capabilities.
- [x] Record official error codes and traffic-control limits.
- [x] Record application package, developer eligibility, review timing,
      authorization duration, and security-standard requirements.
- [x] Record user-consent, six-month re-consent, deletion, audit-trail, and
      cloud-donation obligations.
- [x] Record that the reviewed API documents carrier validation rather than a
      generic OAuth/redirect authorization flow.
- [ ] Confirm whether the current project and operating entity qualify for
      application approval as a personal finance product.
- [x] Record the official test API endpoint and the absence of a documented
      reusable test account or fixture dataset.
- [x] Review the current method list; no push/webhook method is documented, so
      scheduled pull is the provisional delivery mode.
- [ ] Confirm whether the provider offers test credentials or another delivery
      channel outside the reviewed specification.
- [x] Record official consent, retention, deletion, and disclosure obligations.
- [ ] Review project-specific privacy and cross-border legal wording.

## Adapter Design

- [x] Define provider-neutral adapter operations in the requirements document.
- [x] Keep provider data at `source_payload`/draft boundary until confirmation.
- [x] Defer dedicated invoice tables pending the decision gates.
- [ ] Define provider identity and cursor/watermark fields after test access is
      confirmed.
- [ ] Define error classification and retry/backoff cases from live-safe
      fixtures.

## Exit Criteria

- [x] Research has an explicit conditional-go assessment.
- [x] Official application and user-consent obligations are treated as launch
      gates rather than implementation assumptions.
- [x] No production sync code or provider credentials were added.
- [x] No real invoice data is stored in the repository.
- [ ] All blocking decision gates in `requirements.md` have evidence.
- [ ] A follow-up `invoice-import` implementation spec is approved, or the
      integration is recorded as no-go/deferred.

## Verification

This spike is documentation-only. It requires link/source review and static
spec consistency review. It does not run live Ministry of Finance calls, and it
does not weaken the normal application gates for future implementation work.

### Official research refresh — 2026-07-13

- The official test-environment application page was rechecked.
- It requires platform login before application services can be submitted.
- No public consumer test credentials or reusable fixture procedure was found.
- The developer eligibility and application/security evidence requirements
  remain unresolved for an individual personal-finance project.

This refresh strengthens the conditional-go decision; it does not close the
external approval, test-access, or privacy decision gates.

## External Actions Required Before `invoice-import`

- [ ] Name the operating entity that would apply for the official API and
      confirm that it can provide the required responsible-person information.
- [ ] Confirm whether that entity can provide the required CNS 27001 or ISO
      27001 evidence and legal-compliance checklist.
- [ ] Submit or discuss the application with the Ministry of Finance service
      center and ask whether a personal finance ledger is an eligible use case.
- [ ] Request test credentials or an approved fixture procedure before writing
      an integration test.
- [ ] Ask whether any approved push/callback channel exists outside the
      published polling API.
- [ ] Record the answers and either approve the follow-up implementation spec
      or mark official sync no-go/deferred.
