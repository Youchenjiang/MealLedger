import { createTransactionDraft, missingCounterpartyLabel, missingItemNameLabel, type DraftForm, type TransactionDraft } from "../appShell/drafts";

export type AiDraftKind = "expense" | "income" | "transfer";

export type AiSuggestionInput = {
  kind?: unknown;
  date?: unknown;
  account?: unknown;
  category?: unknown;
  counterparty?: unknown;
  itemName?: unknown;
  amount?: unknown;
  currency?: unknown;
  transferAccount?: unknown;
  transferAmount?: unknown;
  note?: unknown;
  // Field names the user explicitly mentioned; fields not listed here were
  // inferred by the model. Absent (not an array) means no provenance was
  // reported, which the suggestion card treats as "no marking".
  explicit?: unknown;
};

export type AiDraftSuggestion = {
  input: AiSuggestionInput;
  draft: TransactionDraft | null;
  ok: boolean;
  issues: string[];
};

export type AiLedgerAccounts = Array<{ name: string; currency: string }>;

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function normalizeKind(value: unknown): AiDraftKind | null {
  const kind = asText(value).toLowerCase();
  if (kind === "income" || kind === "收入") return "income";
  if (kind === "transfer" || kind === "轉帳" || kind === "轉出") return "transfer";
  if (kind === "expense" || kind === "支出" || kind === "") return "expense";
  return null;
}

function normalizeDate(value: unknown, today: string): string {
  const raw = asText(value).replace(/[./]/g, "-");
  const full = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw);
  if (full) {
    const [, year, month, day] = full;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const short = /^(\d{1,2})-(\d{1,2})$/.exec(raw);
  if (short) {
    const year = today.slice(0, 4);
    return `${year}-${short[1].padStart(2, "0")}-${short[2].padStart(2, "0")}`;
  }
  return today;
}

function parseAmount(value: unknown): string {
  const raw = asText(value).replace(/[,$\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    return "";
  }
  return raw;
}

function matchAccount(value: unknown, accounts: AiLedgerAccounts): { name: string; currency: string } | null {
  const raw = asText(value);
  const normalized = raw.toLocaleLowerCase();
  return accounts.find((account) => account.name.toLocaleLowerCase() === normalized) ?? null;
}

function matchCategory(value: unknown, categories: string[]): string {
  const raw = asText(value);
  if (!raw) return "";
  const normalized = raw.toLocaleLowerCase();
  return categories.find((category) => category.toLocaleLowerCase() === normalized) ?? "";
}

function buildForm(input: AiSuggestionInput, account: { name: string; currency: string }, accounts: AiLedgerAccounts, categories: string[], today: string): DraftForm {
  const kind = normalizeKind(input.kind) ?? "expense";
  const category = matchCategory(input.category, categories);
  const amount = parseAmount(input.amount);
  const date = normalizeDate(input.date, today);
  const counterparty = asText(input.counterparty);
  const itemName = asText(input.itemName);

  const form: DraftForm = {
    date,
    account: account.name,
    kind,
    category,
    counterparty: counterparty || missingCounterpartyLabel,
    counterpartyMissing: !counterparty,
    itemName: itemName || missingItemNameLabel,
    itemNameMissing: !itemName,
    transferAccount: "",
    transferMode: "same-currency",
    amount,
    currency: account.currency,
    destinationAmount: "",
    destinationCurrency: "",
    feeEnabled: false,
    feeAccount: "",
    feeAmount: "",
    feeCurrency: "",
    feeCategory: "",
    refundReason: "",
    refundSubtype: "refund",
    refundLinkedRecordId: "",
    refundExcessHandling: "unclassified",
    recurrenceChoice: "current-cycle-only",
    recurrenceAmountMode: "fixed",
    reason: "",
    timePrecision: "day",
    periodStart: "",
    periodEnd: "",
    note: asText(input.note),
    tags: ["AI"],
    sourceLabel: "ai",
  };

  if (kind === "transfer") {
    // Resolve to the matched account name so the draft validator's exact
    // name lookup accepts case-insensitive input from the model, and so the
    // same-account check compares canonical names.
    form.transferAccount = matchAccount(input.transferAccount, accounts)?.name ?? asText(input.transferAccount);
    const transferAmount = parseAmount(input.transferAmount);
    if (transferAmount) {
      form.transferMode = "same-currency";
      form.amount = transferAmount;
    }
  }

  return form;
}

// Builds a ledger form from an AI suggestion, filling only the fields the
// model actually provided. An unknown account or category is left blank
// instead of rejecting the suggestion, so the user can complete it in the
// ledger form before saving.
export function buildPrefillForm(
  input: AiSuggestionInput,
  accounts: AiLedgerAccounts,
  categories: string[],
  today: string,
): DraftForm {
  const account = matchAccount(input.account, accounts) ?? { name: "", currency: "TWD" };
  const form = buildForm(input, account, accounts, categories, today);
  // The manual ledger form uses account selectors, so the destination must be
  // a matched account name; an unknown destination stays blank for the user
  // to pick manually.
  if (form.kind === "transfer") {
    form.transferAccount = matchAccount(input.transferAccount, accounts)?.name ?? "";
  }
  return form;
}

export function parseDraftSuggestions(
  payload: unknown,
  accounts: AiLedgerAccounts,
  categories: string[],
  today: string,
): AiDraftSuggestion[] {
  let items: unknown[];
  if (Array.isArray(payload)) {
    items = payload;
  } else if (Array.isArray((payload as { items?: unknown })?.items)) {
    items = (payload as { items: unknown[] }).items;
  } else {
    items = [];
  }

  return items.map((item): AiDraftSuggestion => {
    const input = (item && typeof item === "object" ? item : {}) as AiSuggestionInput;
    const issues: string[] = [];

    const kind = normalizeKind(input.kind);
    if (!kind) {
      issues.push(`不支援的類型「${asText(input.kind) || "(空白)"}」。`);
    }

    const account = matchAccount(input.account, accounts);
    if (!account) {
      issues.push(`帳戶「${asText(input.account) || "(空白)"}」不存在。`);
    }

    const amount = parseAmount(input.amount);
    const transferAmount = parseAmount(input.transferAmount);
    // Transfers may omit the redundant top-level amount and only provide
    // transferAmount, which buildForm already prefers when building the draft.
    const effectiveAmount = kind === "transfer" && !amount ? transferAmount : amount;
    if (!effectiveAmount) {
      issues.push("金額無法辨識。");
    }

    if (kind === "transfer" && !matchAccount(input.transferAccount, accounts)) {
      issues.push(`轉帳目標帳戶「${asText(input.transferAccount) || "(空白)"}」不存在。`);
    }

    if (!kind || !account || !effectiveAmount) {
      return { input, draft: null, ok: false, issues };
    }

    const form = buildForm(input, account, accounts, categories, today);
    if (kind !== "transfer" && !form.category) {
      issues.push(`類別「${asText(input.category) || "(空白)"}」不存在。`);
    }
    if (form.transferAccount === form.account) {
      issues.push("轉帳來源與目標帳戶相同。");
    }

    if (issues.length > 0) {
      return { input, draft: null, ok: false, issues };
    }

    const draft = createTransactionDraft(form, `ai-${crypto.randomUUID()}`, accounts);
    if (!draft) {
      issues.push("欄位組合未通過既有記帳規則,請手動檢查。");
      return { input, draft: null, ok: false, issues };
    }
    return { input, draft, ok: true, issues };
  });
}
