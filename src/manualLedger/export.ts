import type { LocalLedgerRecord } from "./records";

export const cleanExportColumns = [
  "id",
  "kind",
  "date",
  "time_precision",
  "period_start",
  "period_end",
  "account",
  "amount",
  "currency",
  "category",
  "counterparty",
  "item_name",
  "transfer_account",
  "transfer_mode",
  "destination_amount",
  "destination_currency",
  "fee_account",
  "fee_amount",
  "fee_currency",
  "fee_category",
  "refund_reason",
  "refund_subtype",
  "refund_linked_record_id",
  "refund_excess_handling",
  "reason",
  "note",
  "recurrence_choice",
  "recurrence_amount_mode",
  "status",
  "record_state",
  "version",
] as const;

export type CleanLedgerExportRow = Record<(typeof cleanExportColumns)[number], string | number>;

function activeRecords(records: LocalLedgerRecord[]): LocalLedgerRecord[] {
  return records.filter((record) => record.recordState === "active");
}

export function toCleanExportRow(record: LocalLedgerRecord): CleanLedgerExportRow {
  return {
    id: record.id,
    kind: record.kind,
    date: record.localDate,
    time_precision: record.timePrecision,
    period_start: record.periodStart,
    period_end: record.periodEnd,
    account: record.accountName,
    amount: record.amount,
    currency: record.currency,
    category: record.category,
    counterparty: record.counterparty,
    item_name: record.itemName,
    transfer_account: record.transferAccountName,
    transfer_mode: record.transferMode,
    destination_amount: record.destinationAmount,
    destination_currency: record.destinationCurrency,
    fee_account: record.feeAccountName,
    fee_amount: record.feeAmount,
    fee_currency: record.feeCurrency,
    fee_category: record.feeCategory,
    refund_reason: record.refundReason,
    refund_subtype: record.refundSubtype,
    refund_linked_record_id: record.refundLinkedRecordId,
    refund_excess_handling: record.refundExcessHandling,
    reason: record.reason,
    note: record.note,
    recurrence_choice: record.recurrenceChoice,
    recurrence_amount_mode: record.recurrenceAmountMode,
    status: record.status,
    record_state: record.recordState,
    version: record.version,
  };
}

function escapeCsv(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function serializeCleanCsv(records: LocalLedgerRecord[]): string {
  const rows = activeRecords(records).map(toCleanExportRow);
  const header = cleanExportColumns.join(",");
  const body = rows.map((row) => cleanExportColumns.map((column) => escapeCsv(row[column])).join(","));
  return `\ufeff${[header, ...body].join("\r\n")}\r\n`;
}

export function serializeCleanJson(records: LocalLedgerRecord[]): string {
  return JSON.stringify(activeRecords(records).map(toCleanExportRow), null, 2);
}
