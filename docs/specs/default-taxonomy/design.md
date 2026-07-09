# Default Taxonomy Design

## Taxonomy Shape

V1 uses three grouping dimensions:

- Category: one primary reporting bucket.
- Tag: optional context labels.
- Event: optional real-world project, trip, activity, or reimbursable context.

This avoids forcing labels such as `登山`, `浪費`, or `待還款` into one overloaded category field.

## Seed Strategy

Default seed data should be inserted per user at onboarding or first use.

System defaults should be distinguishable from user-created rows with `is_system_default` or equivalent metadata.

Users can rename or disable seeded categories and tags. Historical records keep stable ids.

## Expense Category Tree

Recommended V1 parent and child examples:

```text
飲食
  早餐
  午餐
  晚餐
  早午餐
  宵夜
  點心
  水果
交通
日用
居家清潔
醫療
學習
電子
服飾
娛樂
禮物人情
手續費罰款
  手續費
  罰款
旅行活動
  門票
  訂金
  登山裝備
  登山服飾
  登山補給
  登山工具
訂閱
  AI
其他
缺漏支出
```

The app should keep the list compact in V1. Users can add more children when needed.

## Income Category Tree

Recommended V1 income categories:

```text
薪資
零用補助
獎金獎學金
紅包
利息
退款報銷
其他收入
```

`初始資金` is available for funding/setup behavior, but reports must keep it separate from earned income.

## Aliases

Aliases support import mapping and search. They should not automatically become categories.

Examples:

| Legacy label | Suggested handling |
| --- | --- |
| `特殊` | Review; suggest more specific category |
| `0` | Review/unresolved |
| `?` | Review/unresolved |
| `AI` | Suggest `訂閱 > AI` |
| `登山` | Suggest event/tag and optional child category |
| `浪費` | Suggest tag |

Aliases should preserve the original text in `source_label` during import.

## UX Notes

Category selectors should show parent and child names in a compact hierarchy.

Tag selectors should allow multiple values.

Event selectors should be optional and separate from category.

Import review should explain why ambiguous labels need review.

## References

- [Product requirements](../../product/product-requirements.md)
- [Accounting rules](../../v1/accounting-rules.md)
- [Schema core design](../schema-core/design.md)
