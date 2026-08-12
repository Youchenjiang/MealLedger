import { createTransactionDraft, type DraftForm, type TransactionDraft } from "../appShell/drafts";
import type { AiEntityPolicy } from "./entityPolicy";
import type { AiLedgerAccounts, NewEntityCarrier } from "./parse";

// The fields a mode B (step-by-step) capture walks through, in the fixed
// order from ADR 0009. When the user says the kind is a transfer, an extra
// transferAccount step is inserted after the account (and the category step
// is skipped, since transfers carry no category).
export type ModeBField = "date" | "kind" | "account" | "transferAccount" | "category" | "counterparty" | "itemName" | "amount";

export const MODE_B_FIELDS: ModeBField[] = ["date", "kind", "account", "category", "counterparty", "itemName", "amount"];

export const MODE_B_FIELD_LABELS: Record<ModeBField, string> = {
  date: "日期",
  kind: "類型",
  account: "帳戶",
  transferAccount: "轉帳目標",
  category: "類別",
  counterparty: "對象",
  itemName: "品項",
  amount: "金額",
};

export const MODE_B_FIELD_PROMPTS: Record<ModeBField, string> = {
  date: "請說日期(例如:七月二十五、7/25、昨天)",
  kind: "請說類型(支出、收入或轉帳)",
  account: "請說帳戶名稱",
  transferAccount: "請說轉帳目標帳戶名稱",
  category: "請說類別",
  counterparty: "請說對象或店家",
  itemName: "請說品項",
  amount: "請說金額(例如:兩百五十、480)",
};

// The step sequence for the current kind: transfers add a destination step
// and drop the category step.
export function modeBStepsFor(kind: string | undefined): ModeBField[] {
  const isTransfer = kind === "transfer";
  const steps: ModeBField[] = ["date", "kind", "account"];
  if (isTransfer) {
    steps.push("transferAccount");
  } else {
    steps.push("category");
  }
  steps.push("counterparty", "itemName", "amount");
  return steps;
}

export type ModeBCorrectionContext = {
  accounts: AiLedgerAccounts;
  categories: string[];
  today: string;
  entityPolicy: AiEntityPolicy;
};

function entityRuleText(
  entity: "account" | "category",
  policy: AiEntityPolicy,
  list: string,
): string {
  const noun = entity === "account" ? "帳戶" : "類別";
  if (policy[entity] === "existing") {
    return `只能用現有${noun}名稱,從這裡選最接近的:${list}。`;
  }
  return `用使用者講的${noun}名稱;若接近現有${noun}請用現有名稱。現有${noun}:${list}。`;
}

// The per-field correction prompt (ADR 0010): normalizes the current field's
// raw speech transcript into the format the ledger form expects.
export function buildFieldCorrectionSystemPrompt(field: ModeBField, context: ModeBCorrectionContext): string {
  const accountList = context.accounts.map((account) => account.name).join("、") || "(尚未建立帳戶)";
  const categoryList = context.categories.join("、") || "(尚未建立類別)";
  const fieldRule = correctionRule(field, context, accountList, categoryList);
  return [
    "你是記帳助理。把使用者的口語輸入轉成單一欄位的正確格式。",
    "只能回傳 JSON,不要任何其他文字或 markdown。",
    '回傳格式: {"value":"欄位值"}',
    `目前欄位: ${MODE_B_FIELD_LABELS[field]}`,
    fieldRule,
    "無法判斷時 value 回空字串,不要編造。",
  ].join("\n");
}

function correctionRule(
  field: ModeBField,
  context: ModeBCorrectionContext,
  accountList: string,
  categoryList: string,
): string {
  switch (field) {
    case "amount":
      return "把口語金額轉成阿拉伯數字(「兩百五十」→250、「一千二」→1200),不含逗號與貨幣符號;已是數字就原樣輸出。";
    case "date":
      return `把口語日期轉成 YYYY-MM-DD(「七月二十五」→${context.today.slice(0, 4)}-07-25、「昨天」→${yesterday(context.today)});今天為 ${context.today}。`;
    case "kind":
      return "類型只能是 expense(支出)、income(收入)、transfer(轉帳);「買了/花了」→expense、「薪水/收入」→income、「轉帳/轉出」→transfer;不確定回空字串。";
    case "account":
      return entityRuleText("account", context.entityPolicy, accountList);
    case "category":
      return entityRuleText("category", context.entityPolicy, categoryList);
    case "counterparty":
    case "itemName":
    case "transferAccount":
      return "保留使用者說的名稱,移除前後空白;無法判斷回空字串。";
  }
}

function yesterday(today: string): string {
  const date = new Date(`${today}T00:00:00`);
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

// Extracts the corrected value from the per-field JSON response. Returns an
// empty string when the payload is missing or malformed; the panel falls back
// to the raw transcript, so correction never blocks the flow.
export function parseFieldCorrection(payload: unknown): string {
  if (payload && typeof payload === "object") {
    const value = (payload as { value?: unknown }).value;
    if (typeof value === "string") return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

export type ModeBDraftResult = {
  draft: TransactionDraft | null;
  issues: string[];
  newAccount?: string;
  newCategory?: string;
  newTransferAccount?: string;
};

function normalizeKindValue(value: string | undefined): "expense" | "income" | "transfer" {
  const kind = (value ?? "").trim().toLowerCase();
  if (kind === "income" || kind === "收入") return "income";
  if (kind === "transfer" || kind === "轉帳" || kind === "轉出") return "transfer";
  return "expense";
}

function matchAccountName(value: string, accounts: AiLedgerAccounts): { name: string; currency: string } | null {
  const normalized = value.toLocaleLowerCase();
  return accounts.find((account) => account.name.toLocaleLowerCase() === normalized) ?? null;
}

function matchCategoryName(value: string, categories: string[]): string {
  const normalized = value.toLocaleLowerCase();
  return categories.find((category) => category.toLocaleLowerCase() === normalized) ?? "";
}

// Assembles the confirmed mode B field values into a validated draft. The
// account/category resolution follows the entity policy (ADR 0012): a
// not-yet-existing name is carried as a new-entity flag under ask/auto and
// rejected under existing-only, mirroring the suggestion parser.
export function buildModeBDraft(
  values: Partial<Record<ModeBField, string>>,
  accounts: AiLedgerAccounts,
  categories: string[],
  today: string,
  policy: AiEntityPolicy,
): ModeBDraftResult {
  const issues: string[] = [];
  const newEntities: NewEntityCarrier = {};

  const kind = normalizeKindValue(values.kind);
  const isTransfer = kind === "transfer";

  const rawAccount = values.account?.trim() ?? "";
  const matchedAccount = matchAccountName(rawAccount, accounts);
  let account = matchedAccount;
  if (!rawAccount) {
    issues.push("帳戶為空白。");
  } else if (!matchedAccount) {
    if (policy.account === "existing") {
      issues.push(`帳戶「${rawAccount}」不存在。`);
    } else {
      newEntities.newAccount = rawAccount;
      account = { name: rawAccount, currency: "TWD" };
    }
  }

  const rawCategory = values.category?.trim() ?? "";
  const matchedCategory = matchCategoryName(rawCategory, categories);
  let category = matchedCategory;
  if (!isTransfer && !rawCategory) {
    issues.push("類別為空白。");
  } else if (!isTransfer && !matchedCategory) {
    if (policy.category === "existing") {
      issues.push(`類別「${rawCategory}」不存在。`);
    } else {
      newEntities.newCategory = rawCategory;
      category = rawCategory;
    }
  }

  const rawTransfer = values.transferAccount?.trim() ?? "";
  const matchedTransfer = matchAccountName(rawTransfer, accounts);
  if (isTransfer && !rawTransfer) {
    issues.push("轉帳目標帳戶為空白。");
  } else if (isTransfer && !matchedTransfer) {
    if (policy.account === "existing") {
      issues.push(`轉帳目標帳戶「${rawTransfer}」不存在。`);
    } else {
      newEntities.newTransferAccount = rawTransfer;
    }
  }

  const amount = values.amount?.trim() ?? "";
  if (!amount) {
    issues.push("金額為空白。");
  }
  const date = values.date?.trim() ?? "";
  if (!date) {
    issues.push("日期為空白。");
  }

  if (issues.length > 0) {
    return { draft: null, issues, ...newEntities };
  }
  const sourceAccount = account;
  if (!sourceAccount) {
    return { draft: null, issues: [...issues, "帳戶為空白。"], ...newEntities };
  }

  const form: DraftForm = {
    date,
    account: sourceAccount.name,
    kind,
    category: isTransfer ? "" : category,
    counterparty: values.counterparty?.trim() ?? "",
    counterpartyMissing: false,
    itemName: values.itemName?.trim() ?? "",
    itemNameMissing: false,
    transferAccount: isTransfer ? (matchedTransfer?.name ?? rawTransfer) : "",
    transferMode: "same-currency",
    amount,
    currency: sourceAccount.currency,
    destinationAmount: "",
    destinationCurrency: "TWD",
    feeEnabled: false,
    feeAccount: "",
    feeAmount: "",
    feeCurrency: "TWD",
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
    note: "",
    tags: ["AI", "語音"],
    sourceLabel: "voice",
  };

  // A new account (or transfer destination) must be visible to the draft
  // validator's exact-name account lookup; synthesize it with TWD like the
  // default wallet so validation passes before the confirmed write.
  const syntheticAccounts: AiLedgerAccounts = [];
  if (newEntities.newAccount) {
    syntheticAccounts.push({ name: newEntities.newAccount, currency: "TWD" });
  }
  if (newEntities.newTransferAccount && newEntities.newTransferAccount !== newEntities.newAccount) {
    syntheticAccounts.push({ name: newEntities.newTransferAccount, currency: "TWD" });
  }
  const draft = createTransactionDraft(form, `mode-b-${crypto.randomUUID()}`, [...accounts, ...syntheticAccounts]);
  if (!draft) {
    issues.push("欄位組合未通過既有記帳規則,請手動檢查。");
    return { draft: null, issues, ...newEntities };
  }
  return { draft, issues, ...newEntities };
}

// Local calendar date (YYYY-MM-DD). toISOString would return the UTC date,
// which trails the local calendar for timezones east of UTC in the early
// hours.
export function localToday(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
