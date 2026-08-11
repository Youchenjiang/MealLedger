# Localization Requirements

Localization makes MealLedger usable for Traditional Chinese users without losing an English fallback for development, review, and future sharing.

## Scope

This spec covers:

- supported UI languages
- copy dictionary boundaries
- language fallback behavior
- date, number, currency, and validation display policy
- layout expectations for longer Traditional Chinese labels

This spec does not translate every future feature before it exists. Feature specs remain responsible for adding their own copy keys when new UI is implemented.

## Requirements

WHEN localization is implemented
THE SYSTEM SHALL support Traditional Chinese (`zh-TW`) as the primary product language.

WHEN a translation key is missing
THE SYSTEM SHALL fall back to English (`en-US`) instead of showing an empty label or raw key.

WHEN UI copy is rendered
THE SYSTEM SHALL read user-facing text from a copy dictionary instead of scattering feature copy across components.

WHEN the user chooses a language
THE SYSTEM SHALL persist the language preference locally.

WHEN no language preference exists
THE SYSTEM SHALL default to `zh-TW` for users whose browser language starts with `zh`, and `en-US` otherwise.

WHEN dates are displayed
THE SYSTEM SHALL format dates using the selected locale while preserving stored ISO date values.

WHEN amounts are displayed
THE SYSTEM SHALL format numbers and currencies using the selected locale and the transaction currency.

WHEN validation messages are displayed
THE SYSTEM SHALL use localized product messages where the app controls the message.

WHEN native browser validation is used
THE SYSTEM MAY rely on browser-provided localized validation text.

WHEN viewed on mobile width
THE SYSTEM SHALL keep navigation, form labels, buttons, and status chips readable in `zh-TW` and `en-US`.

## Non-Functional Requirements

The localization layer must not require network access.

The localization layer must not change stored ledger data.

The localization layer must not translate user-entered account, category, merchant, note, or tag names unless a later feature explicitly supports aliases.
