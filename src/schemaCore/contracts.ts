export const ledgerRecordKinds = [
  "expense",
  "income",
  "fund-addition",
  "refund",
  "unresolved-expense",
  "transfer",
  "adjustment",
] as const;

export type LedgerRecordKind = (typeof ledgerRecordKinds)[number];
export type LedgerRecordState = "active" | "voided";

export type LedgerRecordContract = {
  id: string;
  userId: string;
  kind: LedgerRecordKind;
  recordState: LedgerRecordState;
  accountId: string;
  amountMinor: number;
  currency: string;
  localDate: string | null;
  timePrecision: "day" | "month" | "period";
  periodStart: string | null;
  periodEnd: string | null;
  version: number;
  idempotencyKey: string | null;
};

export type TransferDetailsContract = {
  ledgerRecordId: string;
  destinationAccountId: string;
  destinationAmountMinor: number;
  destinationCurrency: string;
  feeLedgerRecordId: string | null;
};

export type RefundLinkContract = {
  refundRecordId: string;
  originalRecordId: string;
  amountMinor: number;
  currency: string;
  refundSubtype: "refund" | "payback";
};
