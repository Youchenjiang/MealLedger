# Localization Test Plan

## Locale Selection

Test default locale selection from browser language.

Test local language preference overrides browser language.

Test selected language persists after reload.

## Copy Rendering

Test navigation labels render in `zh-TW`.

Test navigation labels render in `en-US`.

Test app-shell page headings, buttons, helper copy, and status labels render from dictionaries.

Test missing `zh-TW` keys fall back to `en-US`.

## Formatting

Test dates display with the selected locale.

Test TWD, JPY, and USD amounts display with the selected locale and currency code.

Test locale formatting does not mutate stored draft data.

## Validation

Test app-controlled validation messages can render in `zh-TW`.

Test app-controlled validation messages can render in `en-US`.

Test native browser validation remains acceptable where native validation is intentionally used.

## Layout

Test desktop layout has no overlapping text in `zh-TW`.

Test mobile layout has no overlapping text in `zh-TW`.

Test desktop layout has no overlapping text in `en-US`.

Test mobile layout has no overlapping text in `en-US`.

Test longer Traditional Chinese labels remain readable in navigation, forms, buttons, and status chips.
