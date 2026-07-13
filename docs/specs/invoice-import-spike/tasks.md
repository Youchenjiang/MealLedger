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
