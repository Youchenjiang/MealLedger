# Default Taxonomy Tasks

## Task 1: Confirm Seed Lists

Review expense categories, income categories, tags, and alias mappings.

Expected verification:

- Reviewer confirms old spreadsheet coverage is not lower than the baseline.

## Task 2: Define Seed Data Format

Create a machine-readable seed format for categories, tags, and aliases.

Expected verification:

- Seed format can express parent/child relationships and aliases.

## Task 3: Define Import Alias Behavior

Status: Complete for local classification and review suggestions.

Implement or specify alias matching for old spreadsheet labels.

Expected verification:

- `特殊`, `0`, and `?` enter review.
- `AI` suggests `訂閱 > AI`.
- `登山` suggests event/tag usage.

## Task 4: Define Selector Behavior

Design category, tag, and event selection behavior for manual ledger forms.

Expected verification:

- Category is single-select.
- Tags are multi-select.
- Event is optional.

## Task 5: Add Taxonomy Tests

Add tests for seed data, aliases, disabled categories, and import review.

Expected verification:

- Tests cover default taxonomy creation and alias review behavior.
