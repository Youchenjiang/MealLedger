# Onboarding Requirements

Onboarding helps a new user create a usable ledger without confusing initial funds with income.

## Scope

This spec covers:

- first workspace experience, whether local-only or authenticated
- first account creation
- initial funds explanation
- default taxonomy setup
- optional spreadsheet import entry point
- local-only and sync guidance

This spec does not implement full CSV import, account statement sync, provider invoice sync, or budgeting.

## Requirements

WHEN a local-only or signed-in user has no ledger account
THE SYSTEM SHALL show onboarding instead of an empty normal overview.

WHEN onboarding starts
THE SYSTEM SHALL explain that MealLedger is ledger-first and photos/meals are optional.

WHEN the user creates the first account
THE SYSTEM SHALL require account name, currency, and account type.

WHEN the user enters current balance for the first account
THE SYSTEM SHALL record it as `fund_addition` or initial funds behavior, not income.

WHEN the user skips current balance
THE SYSTEM SHALL create the account with zero or unknown starting balance according to explicit user choice.

WHEN default taxonomy is needed
THE SYSTEM SHALL offer to apply default categories, tags, and aliases.

WHEN default taxonomy is applied
THE SYSTEM SHALL allow later user edits.

WHEN the user has an existing spreadsheet
THE SYSTEM SHALL offer an import entry point without requiring import before app use.

WHEN import entry point is shown
THE SYSTEM SHALL explain that imported rows enter review before official records are created.

WHEN the app is running as PWA
THE SYSTEM SHALL show whether local data is backed up to cloud or local-only.

WHEN persistent storage is denied or unavailable
THE SYSTEM SHALL warn that local-only offline data may be cleared before sync.

WHEN onboarding is complete
THE SYSTEM SHALL route the user to Overview.

WHEN onboarding is skipped
THE SYSTEM SHALL keep a clear way to return to setup from Settings.

## Instructional Copy Requirements

The onboarding UI should explain:

- `初始資金` changes account balance but is not income.
- A transaction can exist without a photo.
- A meal can exist without a transaction.
- Scanned receipts or invoices create drafts first.
- Clean ledger export does not include image bytes.
