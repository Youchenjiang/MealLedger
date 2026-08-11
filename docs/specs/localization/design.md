# Localization Design

## Language Model

V1 should treat language as a UI preference, not as ledger data. The preferred language affects labels, helper text, validation messages controlled by the app, date display, amount display, and navigation text.

Initial supported languages:

- `zh-TW`: primary user-facing language
- `en-US`: fallback and development review language

## Copy Dictionary

Use a stable dictionary shape so UI components request copy by key:

```ts
type LocaleCode = "zh-TW" | "en-US";
type CopyDictionary = Record<string, string>;
```

Suggested key groups:

- `nav.*`
- `auth.*`
- `overview.*`
- `ledger.*`
- `capture.*`
- `settings.*`
- `status.*`
- `validation.*`

Feature specs should add keys in the same group style when new UI appears.

## Formatting

Dates should be stored as ISO strings and formatted only at display boundaries.

Amounts should keep their numeric value and currency code separate. Display should use `Intl.NumberFormat` with the selected locale and currency code.

Do not infer accounting meaning from locale formatting. Currency, account type, and transaction kind remain explicit data.

## Fallback

If a selected locale lacks a key, render the `en-US` value. If the English value is also missing, render a clearly visible fallback during development so missing copy is caught before review.

## Layout

Traditional Chinese labels may be longer than current English labels once phrased naturally. Components should prefer flexible width, wrapping, and stable icon spacing over fixed text boxes.

Navigation labels should be tested at mobile width before a localization PR is considered complete.

## Boundaries

This spec should not introduce translation management services.

This spec should not translate user-entered ledger content.

This spec should not decide default taxonomy aliases; that belongs to the default-taxonomy spec.

## References

- [App shell requirements](../app-shell/requirements.md)
- [Default taxonomy requirements](../default-taxonomy/requirements.md)
- [Import export requirements](../import-export/requirements.md)
