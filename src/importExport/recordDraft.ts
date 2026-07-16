import type { TransactionDraft } from "../appShell/drafts";
import type { NormalizedImportRow } from "./rowValidation";

export function toImportedTransactionDraft(row: NormalizedImportRow, id: string): TransactionDraft | null {
  if (!row.kind || !row.account || !row.amount || !row.currency) {
    return null;
  }

  const transferMode = transferModeFor(row);
  return {
    id,
    date: textValue(row.date),
    account: row.account,
    kind: row.kind as TransactionDraft["kind"],
    category: textValue(row.category),
    counterparty: firstText(row.merchant, row.source),
    counterpartyMissing: false,
    itemName: textValue(row.item_name),
    itemNameMissing: false,
    transferAccount: textValue(row.target_account),
    transferMode,
    amount: row.amount,
    currency: row.currency,
    destinationAmount: textValue(row.target_amount),
    destinationCurrency: textValue(row.target_currency),
    feeEnabled: Boolean(row.fee_amount),
    feeAccount: textValue(row.fee_account),
    feeAmount: textValue(row.fee_amount),
    feeCurrency: textValue(row.fee_currency),
    feeCategory: textValue(row.fee_category),
    refundReason: textValue(row.refund_reason),
    refundSubtype: refundSubtypeFor(row),
    refundLinkedRecordId: textValue(row.refund_linked_record_id),
    refundLinkedRecordIds: linkedRefundIdsFor(row),
    refundExcessHandling: refundExcessHandlingFor(row),
    recurrenceChoice: "current-cycle-only",
    recurrenceAmountMode: "fixed",
    reason: textValue(row.reason),
    timePrecision: timePrecisionFor(row),
    periodStart: textValue(row.period_start),
    periodEnd: textValue(row.period_end),
    note: textValue(row.notes),
    tags: row.tags?.split("|").map((tag) => tag.trim()).filter(Boolean),
    event: textValue(row.event),
    sourceLabel: textValue(row.source_label),
  };
}

function textValue(value: string | undefined): string {
  return value || "";
}

function firstText(first: string | undefined, second: string | undefined): string {
  return first || second || "";
}

function transferModeFor(row: NormalizedImportRow): TransactionDraft["transferMode"] {
  if (row.target_currency && row.target_currency !== row.currency) return "cross-currency";
  return "same-currency";
}

function refundSubtypeFor(row: NormalizedImportRow): TransactionDraft["refundSubtype"] {
  return row.refund_subtype === "payback" ? "payback" : "refund";
}

function linkedRefundIdsFor(row: NormalizedImportRow): string[] {
  return firstText(row.refund_linked_record_ids, row.refund_linked_record_id).split("|").map((value) => value.trim()).filter(Boolean);
}

function refundExcessHandlingFor(row: NormalizedImportRow): TransactionDraft["refundExcessHandling"] {
  const value = row.refund_excess_handling;
  if (value === "income" || value === "negative-expense" || value === "exchange_difference") return value;
  return "unclassified";
}

function timePrecisionFor(row: NormalizedImportRow): TransactionDraft["timePrecision"] {
  if (row.time_precision === "month" || row.time_precision === "period") return row.time_precision;
  return "day";
}
