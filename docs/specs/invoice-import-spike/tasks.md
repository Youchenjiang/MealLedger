# Invoice Import Spike Tasks

## Research

- [x] Locate the current official application API specification.
- [x] Record developer application, AppID, APIKey, signature, HTTPS, and test
      endpoint requirements.
- [x] Record header, detail, carrier, date-range, and pagination capabilities.
- [x] Record official error codes and traffic-control limits.
- [ ] Confirm application approval criteria for a personal finance product.
- [ ] Confirm user authorization, validation-code lifecycle, and revocation UX.
- [ ] Confirm current test credentials or a safe official fixture process.
- [ ] Confirm push/webhook support or document scheduled pull as the only
      supported delivery mode.
- [ ] Review privacy, retention, and cross-border processing terms.

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
- [x] No production sync code or provider credentials were added.
- [x] No real invoice data is stored in the repository.
- [ ] All blocking decision gates in `requirements.md` have evidence.
- [ ] A follow-up `invoice-import` implementation spec is approved, or the
      integration is recorded as no-go/deferred.

## Verification

This spike is documentation-only. It requires link/source review and static
spec consistency review. It does not run live Ministry of Finance calls, and it
does not weaken the normal application gates for future implementation work.

