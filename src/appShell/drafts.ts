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
  period: string;
  note: string;
};

export type TransactionDraft = DraftForm & {
  id: string;
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
  "period",
  "note",
];

export function normalizeDraftForm(form: DraftForm): DraftForm {
  const normalized = { ...form };

  for (const field of textFields) {
    normalized[field] = normalized[field].trim();
  }

  return normalized;
}

function hasRequiredFields(form: DraftForm, fields: Array<keyof DraftForm>): boolean {
  return fields.every((field) => Boolean(form[field]));
}

function hasCompleteFee(form: DraftForm): boolean {
  return !form.feeEnabled || hasRequiredFields(form, ["feeAccount", "feeAmount", "feeCurrency", "feeCategory"]);
}

export function canCreateManualDraft(form: DraftForm): boolean {
  const normalized = normalizeDraftForm(form);

  switch (normalized.kind) {
    case "expense":
      return hasRequiredFields(normalized, ["date", "account", "amount", "currency", "category", "counterparty", "itemName"]);
    case "income":
      return hasRequiredFields(normalized, ["date", "account", "amount", "currency", "category", "counterparty"]);
    case "transfer":
      if (!hasCompleteFee(normalized)) {
        return false;
      }

      return normalized.transferMode === "same-currency"
        ? hasRequiredFields(normalized, ["date", "account", "transferAccount", "amount", "currency"])
        : hasRequiredFields(normalized, [
            "date",
            "account",
            "transferAccount",
            "amount",
            "currency",
            "destinationAmount",
            "destinationCurrency",
          ]);
    case "refund":
      return hasRequiredFields(normalized, ["date", "account", "amount", "currency", "category", "counterparty", "refundReason"]);
    case "fund-addition":
      return hasRequiredFields(normalized, ["date", "account", "amount", "currency", "counterparty"]);
    case "adjustment":
      return hasRequiredFields(normalized, ["date", "account", "amount", "currency", "reason"]);
    case "unresolved-expense":
      if (!hasRequiredFields(normalized, ["account", "amount", "currency", "timePrecision"])) {
        return false;
      }

      return normalized.timePrecision === "day" ? Boolean(normalized.date) : Boolean(normalized.period);
  }
}

export function createTransactionDraft(form: DraftForm, id: string): TransactionDraft | null {
  const normalized = normalizeDraftForm(form);

  if (!canCreateManualDraft(normalized)) {
    return null;
  }

  return { id, ...normalized };
}
