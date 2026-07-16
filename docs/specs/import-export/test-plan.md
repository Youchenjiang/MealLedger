# Import Export Test Plan

## CSV Import

Test UTF-8 CSV import.

Test UTF-8 with BOM CSV import.

Test unsupported encoding fails with clear message.

Test `YYYY-MM-DD` date import.

Test `YYYY/MM/DD` date import.

Test invalid date creates review item.

Test multi-value tags parse `|`, trim whitespace, remove empty values, and deduplicate.

## Header Mapping

Test `日期` maps to date.

Test `帳戶` maps to account.

Test `金額` maps to amount.

Test `來源` maps to source.

Test `店家` maps to merchant.

Test `名稱` maps to item name.

Test `種類` maps to category.

Test `原帳戶` maps to source account.

Test `後帳戶` maps to target account.

## Kind-Specific Import

Test same-currency transfer can omit target amount.

Test cross-currency transfer requires target amount and target currency.

Test transfer fee columns create linked fee expense.

Test fund addition imports without counting as income.

Test adjustment imports with reason.

Test unresolved expense imports with period fields.

## Aliases And Review

Test `特殊` enters review.

Test `0` enters review or unresolved state.

Test `?` enters review or unresolved state.

Test `AI` suggests `訂閱 > AI`.

Test source label is preserved.

## Deduplication

Test idempotent retry does not duplicate records.

Test expense duplicate warning.

Test transfer duplicate warning.

Test fund addition duplicate warning.

Test adjustment duplicate warning.

Test refund duplicate warning.

Test user can skip duplicate.

Test user can keep duplicate separate.

Test user can link duplicate to existing.

## Export

Test normalized CSV export includes UTF-8 BOM.

Test JSON export uses UTF-8 without BOM.

Test export uses ISO dates.

Test export includes tags and events.

Test export includes media ids but no bytes.

Test export contains no base64 image data.

Test multi-table ZIP includes manifest.

Test multi-table ZIP includes account summary.

Test account summary totals reconcile by account and currency.

Test large export path shows progress or uses long-running export behavior.

Test plural refund links round-trip through clean export and CSV import using `|`.

Test voided records and media bytes remain excluded from every export mode.
