import { describe, expect, test } from "vitest";
import { createMealEntry, linkMealMedia, linkMealTransaction } from "./meals";

describe("meal entries", () => {
  test("requires a time and supports multiple unique photos", () => {
    expect(createMealEntry({ occurredAt: "", mediaAssetIds: ["a"] }, "meal-0")).toBeNull();
    expect(createMealEntry({ occurredAt: "2026-07-13T12:30", mediaAssetIds: ["a", "a", "b"] }, "meal-1")).toEqual(
      expect.objectContaining({ mediaAssetIds: ["a", "b"], transactionIds: [] }),
    );
  });

  test("links transactions and media without duplicating ids", () => {
    const meal = createMealEntry({ occurredAt: "2026-07-13T12:30" }, "meal-1")!;
    const linked = linkMealTransaction(linkMealMedia(meal, "photo-1"), "record-1");

    expect(linkMealMedia(linked, "photo-1").mediaAssetIds).toEqual(["photo-1"]);
    expect(linkMealTransaction(linked, "record-1").transactionIds).toEqual(["record-1"]);
  });
});
