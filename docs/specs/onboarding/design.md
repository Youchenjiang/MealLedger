# Onboarding Design

## Flow

Recommended V1 onboarding steps:

1. Welcome and product positioning.
2. Create first account.
3. Set initial funds or start from zero.
4. Apply default taxonomy.
5. Optional spreadsheet import entry point.
6. Sync and local-only explanation.
7. Finish to Overview.

Each step should be skippable when it is safe to skip. The user should not be trapped before trying the app.

## First Account

Fields:

- account name
- account type
- currency
- allow negative balance
- current balance or start from zero

If current balance is provided, the app should create initial funding behavior behind the scenes rather than income.

## Default Taxonomy

The app can apply default taxonomy automatically for new users, but should explain that categories and tags are editable.

If a user imports an old spreadsheet later, aliases support mapping old labels to the cleaner taxonomy.

## Import Entry

Onboarding should offer import as an option, not a requirement.

Import copy should state:

- CSV is the V1 required format.
- Imported rows go through review.
- Ambiguous labels such as `特殊`, `0`, and `?` require review.
- Images are not part of clean ledger export.

## Sync Guidance

The app should show cloud-backed versus local-only status clearly.

If persistent storage is not granted, onboarding should avoid fear-heavy wording but clearly say unsynced local-only data can be cleared by the browser or operating system.

## Boundaries

Onboarding should not create sample fake ledger records.

Onboarding should not require receipt scans or meal photos.

Onboarding should not start provider sync setup in V1.

## References

- [App shell requirements](../app-shell/requirements.md)
- [Default taxonomy requirements](../default-taxonomy/requirements.md)
- [Manual ledger requirements](../manual-ledger/requirements.md)
- [Technical operations](../../v1/technical-ops.md)
