export const manualRecordKinds = [
  "expense",
  "income",
  "transfer",
  "refund",
  "fund-addition",
  "adjustment",
  "unresolved-expense",
] as const;

export type ManualRecordKind = (typeof manualRecordKinds)[number];

export type ManualFieldControl =
  | "account-select"
  | "category-select"
  | "currency-select"
  | "date"
  | "money"
  | "text"
  | "textarea"
  | "toggle"
  | "period";

export type ManualFieldId =
  | "date"
  | "account"
  | "amount"
  | "currency"
  | "merchant"
  | "merchant-missing"
  | "item-name"
  | "item-name-missing"
  | "category"
  | "source"
  | "source-account"
  | "destination-account"
  | "source-amount"
  | "source-currency"
  | "destination-amount"
  | "destination-currency"
  | "fee-account"
  | "fee-amount"
  | "fee-currency"
  | "fee-category"
  | "refund-reason"
  | "linked-expense"
  | "reason"
  | "time-precision"
  | "period-start"
  | "period-end";

export type ManualField = {
  id: ManualFieldId;
  control: ManualFieldControl;
  label: string;
  required: boolean;
};

export type TransferVariant = {
  id: "same-currency" | "cross-currency";
  label: string;
  requiredFieldIds: ManualFieldId[];
  optionalFieldIds: ManualFieldId[];
};

export type ManualRecordConfig = {
  kind: ManualRecordKind;
  label: string;
  fields: ManualField[];
  transferVariants?: TransferVariant[];
};

const account: ManualField = { id: "account", control: "account-select", label: "Account", required: true };
const amount: ManualField = { id: "amount", control: "money", label: "Amount", required: true };
const currency: ManualField = { id: "currency", control: "currency-select", label: "Currency", required: true };
const date: ManualField = { id: "date", control: "date", label: "Date", required: true };
const category: ManualField = { id: "category", control: "category-select", label: "Category", required: true };

export const manualRecordConfigs: Record<ManualRecordKind, ManualRecordConfig> = {
  expense: {
    kind: "expense",
    label: "Expense",
    fields: [
      date,
      account,
      amount,
      currency,
      { id: "merchant", control: "text", label: "Merchant", required: true },
      { id: "merchant-missing", control: "toggle", label: "Merchant missing", required: false },
      { id: "item-name", control: "text", label: "Item name", required: true },
      { id: "item-name-missing", control: "toggle", label: "Item name missing", required: false },
      category,
    ],
  },
  income: {
    kind: "income",
    label: "Income",
    fields: [date, account, amount, currency, category, { id: "source", control: "text", label: "Source", required: true }],
  },
  transfer: {
    kind: "transfer",
    label: "Transfer",
    fields: [
      date,
      { id: "source-account", control: "account-select", label: "Source account", required: true },
      { id: "destination-account", control: "account-select", label: "Destination account", required: true },
      amount,
      currency,
      { id: "source-amount", control: "money", label: "Source amount", required: false },
      { id: "source-currency", control: "currency-select", label: "Source currency", required: false },
      { id: "destination-amount", control: "money", label: "Destination amount", required: false },
      { id: "destination-currency", control: "currency-select", label: "Destination currency", required: false },
      { id: "fee-account", control: "account-select", label: "Fee account", required: false },
      { id: "fee-amount", control: "money", label: "Fee amount", required: false },
      { id: "fee-currency", control: "currency-select", label: "Fee currency", required: false },
      { id: "fee-category", control: "category-select", label: "Fee category", required: false },
    ],
    transferVariants: [
      {
        id: "same-currency",
        label: "Same currency",
        requiredFieldIds: ["date", "source-account", "destination-account", "amount", "currency"],
        optionalFieldIds: ["fee-account", "fee-amount", "fee-currency", "fee-category"],
      },
      {
        id: "cross-currency",
        label: "Cross currency",
        requiredFieldIds: [
          "date",
          "source-account",
          "source-amount",
          "source-currency",
          "destination-account",
          "destination-amount",
          "destination-currency",
        ],
        optionalFieldIds: ["fee-account", "fee-amount", "fee-currency", "fee-category"],
      },
    ],
  },
  refund: {
    kind: "refund",
    label: "Refund",
    fields: [
      date,
      account,
      amount,
      currency,
      { id: "merchant", control: "text", label: "Merchant or source", required: true },
      category,
      { id: "refund-reason", control: "textarea", label: "Refund reason", required: true },
      { id: "linked-expense", control: "text", label: "Linked expense", required: false },
    ],
  },
  "fund-addition": {
    kind: "fund-addition",
    label: "Initial funding",
    fields: [date, account, amount, currency, { id: "source", control: "text", label: "Source", required: true }],
  },
  adjustment: {
    kind: "adjustment",
    label: "Balance adjustment",
    fields: [date, account, amount, currency, { id: "reason", control: "textarea", label: "Reason", required: true }],
  },
  "unresolved-expense": {
    kind: "unresolved-expense",
    label: "Unresolved expense",
    fields: [
      account,
      amount,
      currency,
      { id: "time-precision", control: "period", label: "Time precision", required: true },
      { id: "date", control: "date", label: "Date", required: false },
      { id: "period-start", control: "date", label: "Period start", required: false },
      { id: "period-end", control: "date", label: "Period end", required: false },
    ],
  },
};

export function getManualRecordConfig(kind: ManualRecordKind): ManualRecordConfig {
  return manualRecordConfigs[kind];
}

export function requiredFieldsFor(kind: ManualRecordKind, transferVariant?: TransferVariant["id"]): ManualFieldId[] {
  const config = getManualRecordConfig(kind);

  if (kind === "transfer") {
    const variant = config.transferVariants?.find((item) => item.id === transferVariant);
    if (!variant) {
      throw new Error("Transfer entries require a transfer variant.");
    }

    return variant.requiredFieldIds;
  }

  return config.fields.filter((field) => field.required).map((field) => field.id);
}
