import type { ManualRecordKind } from "../manualLedger/kinds";
import type { LocalLedgerRecord } from "../manualLedger/records";
import type { NormalizedImportRow } from "./rowValidation";

export type ImportDuplicate = {
  candidateType: "existing-record" | "batch-row";
  candidateId: string;
  candidateRowNumber?: number;
  reason: string;
};

function value(value: string | undefined): string {
  return value?.trim().toLocaleLowerCase() ?? "";
}

function amount(valueToCompare: string | undefined): string {
  const normalized = value(valueToCompare).replace(/,/g, "");
  const numberValue = Number(normalized);
  return Number.isFinite(numberValue) ? String(numberValue) : normalized;
}

function same(...values: Array<[string | undefined, string | undefined]>): boolean {
  return values.every(([left, right]) => value(left) === value(right));
}

function sameAmount(...values: Array<[string | undefined, string | undefined]>): boolean {
  return values.every(([left, right]) => amount(left) === amount(right));
}

function anySame(values: Array<[string | undefined, string | undefined]>): boolean {
  return values.some(([left, right]) => Boolean(value(left)) && value(left) === value(right));
}

function kindOf(row: NormalizedImportRow): ManualRecordKind | "" {
  return (row.kind?.trim() ?? "") as ManualRecordKind | "";
}

type RecordMatcher = (row: NormalizedImportRow, record: LocalLedgerRecord) => string | null;

const recordMatchers: Partial<Record<ManualRecordKind, RecordMatcher>> = {
  expense: (row, record) => anySame([
    [row.merchant, record.counterparty],
    [row.item_name, record.itemName],
  ]) ? "same date, account, amount, and merchant/item" : null,
  income: (row, record) => anySame([[row.source, record.counterparty]]) ? "same date, account, amount, and source" : null,
  "fund-addition": (row, record) => anySame([[row.source, record.counterparty]]) ? "same date, account, amount, and source" : null,
  transfer: (row, record) => {
    const sameTransfer = same([row.target_account, record.transferAccountName], [row.target_currency, record.destinationCurrency])
      && sameAmount([row.target_amount || row.amount, record.destinationAmount || record.amount]);
    return sameTransfer ? "same source, target, date, and transfer amounts" : null;
  },
  refund: (row, record) => {
    const rowLinkedIds = row.refund_linked_record_ids || row.refund_linked_record_id;
    const recordLinkedIds = record.refundLinkedRecordIds?.join("|") || record.refundLinkedRecordId;
    const sameRefund = anySame([[row.merchant, record.counterparty]])
      && same([row.refund_subtype, record.refundSubtype], [rowLinkedIds, recordLinkedIds]);
    return sameRefund ? "same date, account, amount, source, and refund details" : null;
  },
  adjustment: (row, record) => same([row.reason, record.reason]) ? "same date, account, amount, and reason" : null,
  "unresolved-expense": (row, record) => {
    const sameTime = same([row.time_precision, record.timePrecision], [row.period_start, record.periodStart], [row.period_end, record.periodEnd])
      || (value(row.time_precision) === "day" && value(row.date) === value(record.localDate));
    return sameTime ? "same unresolved-expense time, account, and amount" : null;
  },
};

function matchesRecord(row: NormalizedImportRow, record: LocalLedgerRecord): string | null {
  if (record.recordState !== "active" || kindOf(row) !== record.kind) {
    return null;
  }

  const base = same([row.date, record.localDate], [row.account, record.accountName], [row.currency, record.currency])
    && sameAmount([row.amount, record.amount]);
  if (!base) {
    return null;
  }

  return recordMatchers[record.kind]?.(row, record) ?? null;
}

export function detectImportDuplicates(
  rows: Array<{ rowNumber: number; normalized: NormalizedImportRow }>,
  records: LocalLedgerRecord[],
): Map<number, ImportDuplicate[]> {
  const duplicates = new Map<number, ImportDuplicate[]>();

  for (const [index, row] of rows.entries()) {
    const matches = [
      ...findExistingMatches(row.normalized, records),
      ...findBatchMatches(row.normalized, rows.slice(0, index)),
    ];

    if (matches.length > 0) {
      duplicates.set(row.rowNumber, matches);
    }
  }

  return duplicates;
}

function findExistingMatches(normalized: NormalizedImportRow, records: LocalLedgerRecord[]): ImportDuplicate[] {
  return records.flatMap((record) => {
    const reason = matchesRecord(normalized, record);
    return reason ? [{ candidateType: "existing-record", candidateId: record.id, reason }] : [];
  });
}

function findBatchMatches(
  normalized: NormalizedImportRow,
  previousRows: Array<{ rowNumber: number; normalized: NormalizedImportRow }>,
): ImportDuplicate[] {
  return previousRows.flatMap((previous) => {
    const candidateId = `batch-${previous.rowNumber}`;
    const reason = matchesRecord(normalized, importedRowAsRecord(previous.normalized, candidateId));
    return reason ? [{ candidateType: "batch-row", candidateId, candidateRowNumber: previous.rowNumber, reason }] : [];
  });
}

function importedRowAsRecord(normalized: NormalizedImportRow, id: string): LocalLedgerRecord {
  const targetCurrency = normalized.target_currency ?? normalized.currency ?? "";
  const timePrecision = normalized.time_precision === "month" || normalized.time_precision === "period"
    ? normalized.time_precision
    : "day";
  return {
    id,
    recordState: "active",
    kind: kindOf(normalized),
    localDate: normalized.date ?? "",
    accountName: normalized.account ?? "",
    amount: normalized.amount ?? "",
    currency: normalized.currency ?? "",
    counterparty: normalized.merchant ?? normalized.source ?? "",
    counterpartyMissing: false,
    itemName: normalized.item_name ?? "",
    itemNameMissing: false,
    transferAccountName: normalized.target_account ?? "",
    destinationAmount: normalized.target_amount ?? normalized.amount ?? "",
    destinationCurrency: targetCurrency,
    refundSubtype: normalized.refund_subtype === "payback" ? "payback" : "refund",
    refundLinkedRecordId: normalized.refund_linked_record_id ?? "",
    timePrecision,
    periodStart: normalized.period_start ?? "",
    periodEnd: normalized.period_end ?? "",
    reason: normalized.reason ?? "",
  } as LocalLedgerRecord;
}
