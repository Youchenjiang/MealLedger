import type { TransactionDraft } from "../appShell/drafts";

export type InitialFundingInput = {
  account: string;
  amount: string;
  currency: string;
  date: string;
  source?: string;
};

export function createInitialFundingDraft(input: InitialFundingInput, id: string): TransactionDraft | null {
  const account = input.account.trim();
  const amount = input.amount.trim();
  const currency = input.currency.trim();
  const date = input.date.trim();

  if (!account || !amount || !currency || !date || Number(amount) <= 0 || !Number.isFinite(Number(amount))) {
    return null;
  }

  return {
    id,
    date,
    account,
    kind: "fund-addition",
    category: "",
    counterparty: input.source?.trim() || "Initial funds",
    counterpartyMissing: false,
    itemName: "",
    itemNameMissing: false,
    transferAccount: "",
    transferMode: "same-currency",
    amount,
    currency,
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
    refundLinkedRecordIds: [],
    refundExcessHandling: "unclassified",
    recurrenceChoice: "current-cycle-only",
    recurrenceAmountMode: "fixed",
    reason: "",
    timePrecision: "day",
    periodStart: "",
    periodEnd: "",
    note: "",
  };
}
