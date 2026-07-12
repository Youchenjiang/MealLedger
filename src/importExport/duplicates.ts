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

function matchesRecord(row: NormalizedImportRow, record: LocalLedgerRecord): string | null {
  if (record.recordState !== "active" || kindOf(row) !== record.kind) {
    return null;
  }

  const base = same([row.date, record.localDate], [row.account, record.accountName], [row.currency, record.currency])
    && sameAmount([row.amount, record.amount]);
  if (!base) {
    return null;
  }

  switch (record.kind) {
    case "expense":
      return anySame([
        [row.merchant, record.counterparty],
        [row.item_name, record.itemName],
      ]) ? "same date, account, amount, and merchant/item" : null;
    case "income":
    case "fund-addition":
      return anySame([[row.source, record.counterparty]]) ? "same date, account, amount, and source" : null;
    case "transfer":
      return same([row.target_account, record.transferAccountName], [row.target_currency, record.destinationCurrency])
        && sameAmount([row.target_amount || row.amount, record.destinationAmount || record.amount])
        ? "same source, target, date, and transfer amounts" : null;
    case "refund":
      return anySame([[row.merchant, record.counterparty]])
        && same([row.refund_subtype, record.refundSubtype], [row.refund_linked_record_id, record.refundLinkedRecordId])
        ? "same date, account, amount, source, and refund details" : null;
    case "adjustment":
      return same([row.reason, record.reason]) ? "same date, account, amount, and reason" : null;
    case "unresolved-expense":
      return same([row.time_precision, record.timePrecision], [row.period_start, record.periodStart], [row.period_end, record.periodEnd])
        || (value(row.time_precision) === "day" && value(row.date) === value(record.localDate))
        ? "same unresolved-expense time, account, and amount" : null;
  }
}

export function detectImportDuplicates(
  rows: Array<{ rowNumber: number; normalized: NormalizedImportRow }>,
  records: LocalLedgerRecord[],
): Map<number, ImportDuplicate[]> {
  const duplicates = new Map<number, ImportDuplicate[]>();

  for (const [index, row] of rows.entries()) {
    const matches: ImportDuplicate[] = [];
    for (const record of records) {
      const reason = matchesRecord(row.normalized, record);
      if (reason) {
        matches.push({ candidateType: "existing-record", candidateId: record.id, reason });
      }
    }

    for (const previous of rows.slice(0, index)) {
      const reason = matchesRecord(row.normalized, {
        id: `batch-${previous.rowNumber}`,
        recordState: "active",
        kind: kindOf(previous.normalized),
        localDate: previous.normalized.date ?? "",
        accountName: previous.normalized.account ?? "",
        amount: previous.normalized.amount ?? "",
        currency: previous.normalized.currency ?? "",
        counterparty: previous.normalized.merchant ?? previous.normalized.source ?? "",
        counterpartyMissing: false,
        itemName: previous.normalized.item_name ?? "",
        itemNameMissing: false,
        transferAccountName: previous.normalized.target_account ?? "",
        destinationAmount: previous.normalized.target_amount ?? previous.normalized.amount ?? "",
        destinationCurrency: previous.normalized.target_currency ?? previous.normalized.currency ?? "",
        refundSubtype: previous.normalized.refund_subtype === "payback" ? "payback" : "refund",
        refundLinkedRecordId: previous.normalized.refund_linked_record_id ?? "",
        timePrecision: previous.normalized.time_precision === "month" || previous.normalized.time_precision === "period" ? previous.normalized.time_precision : "day",
        periodStart: previous.normalized.period_start ?? "",
        periodEnd: previous.normalized.period_end ?? "",
        reason: previous.normalized.reason ?? "",
      } as LocalLedgerRecord);
      if (reason) {
        matches.push({ candidateType: "batch-row", candidateId: `batch-${previous.rowNumber}`, candidateRowNumber: previous.rowNumber, reason });
      }
    }

    if (matches.length > 0) {
      duplicates.set(row.rowNumber, matches);
    }
  }

  return duplicates;
}
