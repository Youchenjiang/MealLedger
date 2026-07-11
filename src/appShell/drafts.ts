import { manualRecordKinds, type ManualRecordKind } from "../manualLedger/kinds";

export { manualRecordKinds as draftKinds };

export type DraftKind = ManualRecordKind;
export type TransferMode = "same-currency" | "cross-currency";
export type TimePrecision = "day" | "month" | "period";

export type DraftForm = {
  date: string;
  account: string;
  kind: DraftKind;
  category: string;
  counterparty: string;
  itemName: string;
  transferAccount: string;
  transferMode: TransferMode;
  amount: string;
  currency: string;
  destinationAmount: string;
  destinationCurrency: string;
  feeEnabled: boolean;
  feeAccount: string;
  feeAmount: string;
  feeCurrency: string;
  feeCategory: string;
  refundReason: string;
  reason: string;
  timePrecision: TimePrecision;
  periodStart: string;
  periodEnd: string;
};

export type TransactionDraft = DraftForm & {
  id: string;
};

export type DraftAccount = {
  name: string;
  currency: string;
};

const textFields: Array<keyof Omit<DraftForm, "feeEnabled" | "kind" | "timePrecision" | "transferMode">> = [
  "date",
  "account",
  "category",
  "counterparty",
  "itemName",
  "transferAccount",
  "amount",
  "currency",
  "destinationAmount",
  "destinationCurrency",
  "feeAccount",
  "feeAmount",
  "feeCurrency",
  "feeCategory",
  "refundReason",
  "reason",
  "periodStart",
  "periodEnd",
];

export function normalizeDraftForm(form: DraftForm): DraftForm {
  const normalized = { ...form };

  for (const field of textFields) {
    normalized[field] = normalized[field].trim();
  }

  return normalized;
}

export function monthToPeriodRange(month: string): { periodStart: string; periodEnd: string } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12) {
    return null;
  }

  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    periodStart: `${month}-01`,
    periodEnd: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

function hasRequiredFields(form: DraftForm, fields: Array<keyof DraftForm>): boolean {
  return fields.every((field) => Boolean(form[field]));
}

function hasCompleteFee(form: DraftForm): boolean {
  return !form.feeEnabled
    || (hasRequiredFields(form, ["feeAccount", "feeAmount", "feeCurrency", "feeCategory"])
      && isPositiveAmount(form.feeAmount));
}

function isPositiveAmount(value: string): boolean {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0;
}

function isNonZeroAmount(value: string): boolean {
  const amount = Number(value);
  return Number.isFinite(amount) && amount !== 0;
}

function accountFor(accounts: DraftAccount[], name: string): DraftAccount | undefined {
  return accounts.find((account) => account.name === name);
}

function hasMatchingAccountCurrency(form: DraftForm, accounts: DraftAccount[]): boolean {
  const account = accountFor(accounts, form.account);
  return Boolean(account && account.currency === form.currency);
}

function hasValidFeeAccount(form: DraftForm, accounts: DraftAccount[]): boolean {
  if (!form.feeEnabled) {
    return true;
  }

  const account = accountFor(accounts, form.feeAccount);
  return Boolean(account && account.currency === form.feeCurrency);
}

export function canCreateManualDraft(form: DraftForm, accounts: DraftAccount[]): boolean {
  const normalized = normalizeDraftForm(form);

  if (!hasMatchingAccountCurrency(normalized, accounts)) {
    return false;
  }

  switch (normalized.kind) {
    case "expense":
      return hasRequiredFields(normalized, ["date", "account", "amount", "currency", "category", "counterparty", "itemName"])
        && isPositiveAmount(normalized.amount);
    case "income":
      return hasRequiredFields(normalized, ["date", "account", "amount", "currency", "category", "counterparty"])
        && isPositiveAmount(normalized.amount);
    case "transfer":
      const destinationAccount = accountFor(accounts, normalized.transferAccount);
      if (!hasCompleteFee(normalized) || !hasValidFeeAccount(normalized, accounts) || !destinationAccount || normalized.account === normalized.transferAccount) {
        return false;
      }

      return normalized.transferMode === "same-currency"
        ? hasRequiredFields(normalized, ["date", "account", "transferAccount", "amount", "currency"])
          && isPositiveAmount(normalized.amount)
          && destinationAccount.currency === normalized.currency
        : hasRequiredFields(normalized, [
            "date",
            "account",
            "transferAccount",
            "amount",
            "currency",
            "destinationAmount",
            "destinationCurrency",
          ])
          && isPositiveAmount(normalized.amount)
          && isPositiveAmount(normalized.destinationAmount)
          && destinationAccount.currency === normalized.destinationCurrency;
    case "refund":
      return hasRequiredFields(normalized, ["date", "account", "amount", "currency", "category", "counterparty", "refundReason"])
        && isPositiveAmount(normalized.amount);
    case "fund-addition":
      return hasRequiredFields(normalized, ["date", "account", "amount", "currency", "counterparty"])
        && isPositiveAmount(normalized.amount);
    case "adjustment":
      return hasRequiredFields(normalized, ["date", "account", "amount", "currency", "reason"])
        && isNonZeroAmount(normalized.amount);
    case "unresolved-expense":
      if (!hasRequiredFields(normalized, ["account", "amount", "currency", "timePrecision"])) {
        return false;
      }

      if (!isPositiveAmount(normalized.amount)) {
        return false;
      }

      if (normalized.timePrecision === "day") {
        return Boolean(normalized.date);
      }

      return hasRequiredFields(normalized, ["periodStart", "periodEnd"])
        && normalized.periodStart <= normalized.periodEnd;
  }
}

export function createTransactionDraft(form: DraftForm, id: string, accounts: DraftAccount[]): TransactionDraft | null {
  const normalized = normalizeDraftForm(form);

  if (!canCreateManualDraft(normalized, accounts)) {
    return null;
  }

  return { id, ...normalized };
}
