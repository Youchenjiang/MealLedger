export type CategoryAliasReview = {
  input: string;
  status: "accepted" | "review";
  suggestedCategory: string | null;
  suggestedEvent: string | null;
  suggestedTag: string | null;
  reason: string;
};

const ambiguousAliases: Record<string, Omit<CategoryAliasReview, "input" | "status">> = {
  特殊: {
    suggestedCategory: null,
    suggestedEvent: null,
    suggestedTag: null,
    reason: "Choose a more specific category such as fee, fine, deposit, ticket, gift, or treat.",
  },
  "0": {
    suggestedCategory: "缺漏支出",
    suggestedEvent: null,
    suggestedTag: null,
    reason: "This label is treated as unresolved/import review, not a normal category.",
  },
  "?": {
    suggestedCategory: "缺漏支出",
    suggestedEvent: null,
    suggestedTag: null,
    reason: "This label is treated as unresolved/import review, not a normal category.",
  },
  AI: {
    suggestedCategory: "訂閱 > AI",
    suggestedEvent: null,
    suggestedTag: null,
    reason: "AI is a subscription child category and still needs user confirmation.",
  },
  登山: {
    suggestedCategory: "旅行活動",
    suggestedEvent: "登山",
    suggestedTag: "登山",
    reason: "Use an event or tag for the activity; keep reporting categories specific.",
  },
  浪費: {
    suggestedCategory: null,
    suggestedEvent: null,
    suggestedTag: "浪費",
    reason: "Prefer this emotional/context label as a tag rather than a reporting category.",
  },
};

export function classifyCategoryAlias(value: string): CategoryAliasReview {
  const input = value.trim();
  const alias = ambiguousAliases[input];

  if (alias) {
    return { input, status: "review", ...alias };
  }

  if (!input) {
    return {
      input,
      status: "review",
      suggestedCategory: "缺漏支出",
      suggestedEvent: null,
      suggestedTag: null,
      reason: "Category is missing and must be confirmed during import review.",
    };
  }

  return {
    input,
    status: "accepted",
    suggestedCategory: input,
    suggestedEvent: null,
    suggestedTag: null,
    reason: "Existing category label can continue to review.",
  };
}

export function categoryReviewSummary(value: string): string | null {
  const review = classifyCategoryAlias(value);
  if (review.status !== "review") {
    return null;
  }

  const suggestion = review.suggestedCategory ? ` Suggested: ${review.suggestedCategory}.` : "";
  return `${review.input || "(blank)"} requires review.${suggestion} ${review.reason}`;
}
