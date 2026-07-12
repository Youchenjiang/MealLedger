import { describe, expect, test } from "vitest";
import { applyDefaultTaxonomy, defaultTaxonomyAliases } from "./defaults";

describe("default taxonomy", () => {
  test("adds categories, tags, and aliases once", () => {
    const first = applyDefaultTaxonomy({ categories: ["日用"], tags: ["旅行"], aliases: [] });
    const second = applyDefaultTaxonomy(first);

    expect(first.categories).toContain("飲食");
    expect(first.tags).toContain("訂閱");
    expect(first.aliases).toEqual(expect.arrayContaining(defaultTaxonomyAliases));
    expect(second).toEqual(first);
  });

  test("keeps existing labels and treats casing as duplicate", () => {
    const result = applyDefaultTaxonomy({ categories: ["daily", "日用"], tags: [], aliases: [] });

    expect(result.categories.filter((label) => label.toLocaleLowerCase() === "daily")).toHaveLength(1);
    expect(result.categories.filter((label) => label === "日用")).toHaveLength(1);
  });
});
