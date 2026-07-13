export type MealEntry = {
  id: string;
  occurredAt: string;
  note: string;
  transactionIds: string[];
  mediaAssetIds: string[];
  status: "local-only" | "synced";
};

export type MealEntryInput = {
  occurredAt: string;
  note?: string;
  transactionIds?: string[];
  mediaAssetIds?: string[];
};

export function createMealEntry(input: MealEntryInput, id: string): MealEntry | null {
  const occurredAt = input.occurredAt.trim();
  if (!occurredAt) {
    return null;
  }

  return {
    id,
    occurredAt,
    note: input.note?.trim() ?? "",
    transactionIds: uniqueIds(input.transactionIds ?? []),
    mediaAssetIds: uniqueIds(input.mediaAssetIds ?? []),
    status: "local-only",
  };
}

export function linkMealMedia(meal: MealEntry, mediaAssetId: string): MealEntry {
  return {
    ...meal,
    status: "local-only",
    mediaAssetIds: uniqueIds([...meal.mediaAssetIds, mediaAssetId]),
  };
}

export function linkMealTransaction(meal: MealEntry, transactionId: string): MealEntry {
  return {
    ...meal,
    status: "local-only",
    transactionIds: uniqueIds([...meal.transactionIds, transactionId]),
  };
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}
