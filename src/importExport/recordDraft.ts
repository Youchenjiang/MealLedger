import type { TransactionDraft } from "../appShell/drafts";
import type { NormalizedImportRow } from "./rowValidation";

export function toImportedTransactionDraft(row: NormalizedImportRow, id: string): TransactionDraft | null {
  if (!row.kind || !row.account || !row.amount || !row.currency) {
    return null;
  }

  const transferMode = row.target_currency && row.target_currency !== row.currency ? "cross-currency" : "same-currency";
  return {
    id,
    date: row.date ?? "",
    account: row.account,
    kind: row.kind as TransactionDraft["kind"],
    category: row.category ?? "",
    counterparty: row.merchant ?? row.source ?? "",
    counterpartyMissing: false,
    itemName: row.item_name ?? "",
    itemNameMissing: false,
    transferAccount: row.target_account ?? "",
    transferMode,
    amount: row.amount,
    currency: row.currency,
    destinationAmount: row.target_amount ?? "",
    destinationCurrency: row.target_currency ?? "",
    feeEnabled: Boolean(row.fee_amount),
    feeAccount: row.fee_account ?? "",
    feeAmount: row.fee_amount ?? "",
    feeCurrency: row.fee_currency ?? "",
    feeCategory: row.fee_category ?? "",
    refundReason: row.refund_reason ?? "",
    refundSubtype: row.refund_subtype === "payback" ? "payback" : "refund",
    refundLinkedRecordId: row.refund_linked_record_id ?? "",
    refundExcessHandling: "unclassified",
    recurrenceChoice: "current-cycle-only",
    recurrenceAmountMode: "fixed",
    reason: row.reason ?? "",
    timePrecision: row.time_precision === "month" || row.time_precision === "period" ? row.time_precision : "day",
    periodStart: row.period_start ?? "",
    periodEnd: row.period_end ?? "",
    note: row.notes ?? "",
  };
}
