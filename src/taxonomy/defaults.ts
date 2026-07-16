export type TaxonomyCategorySeed = {
  name: string;
  parent: string | null;
  scope: "expense" | "income";
};

export type TaxonomyAliasSeed = {
  alias: string;
  canonical: string;
};

export const defaultTaxonomyCategories: TaxonomyCategorySeed[] = [
  { name: "日用", parent: null, scope: "expense" },
  { name: "電子", parent: null, scope: "expense" },
  { name: "清潔", parent: null, scope: "expense" },
  { name: "交通", parent: null, scope: "expense" },
  { name: "飲食", parent: null, scope: "expense" },
  { name: "早餐", parent: "飲食", scope: "expense" },
  { name: "午餐", parent: "飲食", scope: "expense" },
  { name: "晚餐", parent: "飲食", scope: "expense" },
  { name: "早午餐", parent: "飲食", scope: "expense" },
  { name: "宵夜", parent: "飲食", scope: "expense" },
  { name: "點心", parent: "飲食", scope: "expense" },
  { name: "水果", parent: "飲食", scope: "expense" },
  { name: "服飾", parent: null, scope: "expense" },
  { name: "鞋襪", parent: "服飾", scope: "expense" },
  { name: "學習", parent: null, scope: "expense" },
  { name: "文具", parent: "學習", scope: "expense" },
  { name: "醫藥", parent: null, scope: "expense" },
  { name: "收藏", parent: null, scope: "expense" },
  { name: "園藝", parent: null, scope: "expense" },
  { name: "娛樂", parent: null, scope: "expense" },
  { name: "郵費", parent: null, scope: "expense" },
  { name: "登山", parent: null, scope: "expense" },
  { name: "租賃", parent: null, scope: "expense" },
  { name: "浪費", parent: null, scope: "expense" },
  { name: "禮物", parent: null, scope: "expense" },
  { name: "退款", parent: null, scope: "expense" },
  { name: "AI", parent: null, scope: "expense" },
  { name: "薪資", parent: null, scope: "income" },
  { name: "利息", parent: null, scope: "income" },
  { name: "零用錢", parent: null, scope: "income" },
  { name: "紅包", parent: null, scope: "income" },
  { name: "獎學金", parent: null, scope: "income" },
  { name: "獎勵", parent: null, scope: "income" },
  { name: "補助", parent: null, scope: "income" },
  { name: "退款收入", parent: null, scope: "income" },
  { name: "報銷", parent: null, scope: "income" },
  { name: "其他收入", parent: null, scope: "income" },
];

export const defaultTaxonomyTags = ["代墊", "待還款", "登山", "旅行", "請客", "訂閱"];

export const defaultTaxonomyAliases: TaxonomyAliasSeed[] = [
  { alias: "0", canonical: "未分類支出" },
  { alias: "?", canonical: "未分類支出" },
  { alias: "特殊", canonical: "其他支出" },
  { alias: "退款(收入)", canonical: "退款收入" },
];

export const defaultCategoryLabels = defaultTaxonomyCategories.map((category) => category.name);
export const defaultIncomeCategoryLabels = defaultTaxonomyCategories
  .filter((category) => category.scope === "income")
  .map((category) => category.name);

export function mergeUniqueLabels(existing: string[], additions: string[]): string[] {
  const result = [...existing];
  const seen = new Set(existing.map((value) => value.trim().toLocaleLowerCase()));

  for (const addition of additions) {
    const normalized = addition.trim();
    const key = normalized.toLocaleLowerCase();
    if (normalized && !seen.has(key)) {
      result.push(normalized);
      seen.add(key);
    }
  }

  return result;
}

export function applyDefaultTaxonomy(existing: { categories: string[]; tags: string[]; aliases: TaxonomyAliasSeed[] }) {
  const aliases = [...existing.aliases];
  const aliasKeys = new Set(aliases.map((item) => `${item.alias.toLocaleLowerCase()}\u0000${item.canonical.toLocaleLowerCase()}`));

  for (const alias of defaultTaxonomyAliases) {
    const key = `${alias.alias.toLocaleLowerCase()}\u0000${alias.canonical.toLocaleLowerCase()}`;
    if (!aliasKeys.has(key)) {
      aliases.push(alias);
      aliasKeys.add(key);
    }
  }

  return {
    categories: mergeUniqueLabels(existing.categories, defaultCategoryLabels),
    tags: mergeUniqueLabels(existing.tags, defaultTaxonomyTags),
    aliases,
  };
}
