# Default Taxonomy Requirements

Default taxonomy gives new users a useful starting point and gives spreadsheet import a safe mapping target. It must not flatten every old spreadsheet label into permanent first-class categories.

## Scope

This spec covers:

- default expense categories
- default income categories
- default tags
- default event examples
- legacy aliases
- import review behavior for ambiguous labels

This spec does not implement budgeting, tax reporting, reimbursement workflows, or category merge UI.

## Category Requirements

WHEN a new user starts V1
THE SYSTEM SHALL provide a clean default category taxonomy.

WHEN categories are shown for expense entry
THE SYSTEM SHALL support parent and child categories.

WHEN categories are shown for income entry
THE SYSTEM SHALL use income-specific categories and not reuse expense-only categories.

WHEN a category is disabled
THE SYSTEM SHALL hide it from new-entry selectors by default while keeping historical records readable.

WHEN an imported label is ambiguous
THE SYSTEM SHALL preserve the original label and require review instead of silently assigning a permanent category.

## Expense Defaults

WHEN V1 seeds expense categories
THE SYSTEM SHALL include these parent categories:

- `飲食`
- `交通`
- `日用`
- `居家清潔`
- `醫療`
- `學習`
- `電子`
- `服飾`
- `娛樂`
- `禮物人情`
- `手續費罰款`
- `旅行活動`
- `訂閱`
- `其他`
- `缺漏支出`

WHEN V1 seeds food-related child categories
THE SYSTEM SHALL include `早餐`, `午餐`, `晚餐`, `早午餐`, `宵夜`, `點心`, and `水果` under `飲食`.

WHEN V1 seeds subscription child categories
THE SYSTEM SHALL include `AI` under `訂閱`.

WHEN V1 seeds hiking-related examples
THE SYSTEM SHALL prefer event/tag support for `登山` and may include children such as `登山裝備`, `登山服飾`, `登山補給`, and `登山工具` under `旅行活動`.

## Income Defaults

WHEN V1 seeds income categories
THE SYSTEM SHALL include:

- `薪資`
- `零用補助`
- `獎金獎學金`
- `紅包`
- `利息`
- `退款報銷`
- `其他收入`

WHEN V1 seeds fund-related categories
THE SYSTEM SHALL keep `初始資金` separate from earned income reporting.

WHEN importing income labels such as `紅包(母)`
THE SYSTEM SHALL suggest category `紅包` and source `母` without changing the fixed income fields.

## Tag Defaults

WHEN V1 seeds tags
THE SYSTEM SHALL include:

- `請客`
- `代墊`
- `待還款`
- `浪費`
- `報銷`
- `旅行`
- `登山`
- `早餐`
- `午餐`
- `晚餐`
- `宵夜`
- `點心`

WHEN a label is emotional or review-oriented, such as `浪費`
THE SYSTEM SHALL prefer tag usage over permanent reporting category usage unless the user explicitly creates that category.

## Legacy Alias Requirements

WHEN importing `特殊`
THE SYSTEM SHALL treat it as an alias requiring review and suggest clearer targets such as `手續費`, `罰款`, `訂金`, `門票`, `禮物`, `請客`, `宗教習俗`, or `其他`.

WHEN importing `0` or `?`
THE SYSTEM SHALL map it to unresolved/import-review state, not a normal category.

WHEN importing old meal labels
THE SYSTEM SHALL allow them as expense child categories and meal-period tags.

WHEN an alias is mapped
THE SYSTEM SHALL preserve the original label as `source_label`.

## Event Boundary

WHEN a real-world activity groups multiple kinds of records
THE SYSTEM SHALL use event rather than forcing the activity to be a spending category.

WHEN modeling `登山`
THE SYSTEM SHALL support it as an event or tag and allow specific spending to use ordinary reporting categories.
