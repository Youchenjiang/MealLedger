# Default Taxonomy Test Plan

## Seed Data

Test new user receives default expense parent categories.

Test new user receives default income categories.

Test new user receives default tags.

Test seeded categories can be disabled without deleting historical data.

Test seeded categories have stable ids after rename.

## Category Behavior

Test expense entry uses expense categories.

Test income entry uses income categories.

Test one ledger record has one reporting category.

Test record can have multiple tags.

Test event is optional and separate from category.

## Alias Behavior

Test importing `特殊` creates review-needed mapping.

Test importing `0` creates unresolved or import-review state.

Test importing `?` creates unresolved or import-review state.

Test importing `AI` suggests `訂閱 > AI`.

Test importing `登山` suggests event/tag usage and optional child categories.

Test importing `浪費` suggests tag usage.

Test mapped aliases preserve original text as `source_label`.

## Reporting

Test parent category rollup includes child categories.

Test disabled category remains visible in historical reports.

Test `初始資金` does not count as earned income.

Test unresolved category totals reconcile with total spending.
