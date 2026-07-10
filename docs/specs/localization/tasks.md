# Localization Tasks

## Task 1: Locale Preference

Add a locale preference with `zh-TW` and `en-US`.

Expected verification:

- Browser language can provide the initial locale.
- Local preference overrides browser language.

## Task 2: Copy Dictionary

Move app-shell user-facing copy into locale dictionaries.

Expected verification:

- Navigation labels render from dictionary values.
- Overview, Ledger, Capture, and Settings copy renders from dictionary values.
- Missing `zh-TW` keys fall back to `en-US`.

## Task 3: Language Control

Add a simple Settings control for changing language.

Expected verification:

- User can switch between `zh-TW` and `en-US`.
- Selected language persists locally.

## Task 4: Formatting

Localize display formatting for dates and currency amounts.

Expected verification:

- Existing draft date displays in the selected locale.
- Existing draft amount displays with the selected locale and currency code.
- Stored draft data remains unchanged.

## Task 5: Responsive Review

Verify localized layouts.

Expected verification:

- `zh-TW` navigation and form labels do not overlap on mobile width.
- `en-US` navigation and form labels do not overlap on mobile width.
- Status chips remain readable in both languages.
