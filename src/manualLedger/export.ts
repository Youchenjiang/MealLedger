import type { LocalAccount } from "./accounts";
import { calculateAccountBalances } from "./balances";
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
  "refund_linked_record_ids",
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

const accountSummaryColumns = [
  "account_id",
  "account_name",
  "currency",
  "opening_balance",
  "income_total",
  "expense_total",
  "refund_total",
  "fund_addition_total",
  "transfer_in_total",
  "transfer_out_total",
  "adjustment_total",
  "closing_balance",
  "record_count",
] as const;

type AccountSummaryRow = Record<(typeof accountSummaryColumns)[number], string | number>;

const multiTablePaths = [
  "ledger/transactions.csv",
  "ledger/transfers.csv",
  "ledger/fund_additions.csv",
  "ledger/refunds.csv",
  "ledger/unresolved_expenses.csv",
  "ledger/adjustments.csv",
  "reports/account_summary.csv",
] as const;

export type MultiTableExportBundle = {
  files: Record<string, string>;
  manifest: {
    app: string;
    schema_version: string;
    exported_at: string;
    user_id_hash: string;
    export_mode: "multi-table";
    date_range: { start: string | null; end: string | null };
    currency_modes: string[];
    files: string[];
    record_counts: Record<string, number>;
  };
  zip: Uint8Array;
};

export type ExportProgress = (percentage: number, stage: "preparing" | "building" | "complete") => void;

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
    refund_linked_record_ids: (record.refundLinkedRecordIds?.length ? record.refundLinkedRecordIds : [record.refundLinkedRecordId]).filter(Boolean).join("|"),
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
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function serializeRows<T extends string>(columns: readonly T[], rows: Array<Record<T, string | number>>): string {
  const header = columns.join(",");
  const body = rows.map((row) => columns.map((column) => escapeCsv(row[column])).join(","));
  return `\ufeff${[header, ...body].join("\r\n")}\r\n`;
}

export function serializeCleanCsv(records: LocalLedgerRecord[]): string {
  return serializeRows(cleanExportColumns, activeRecords(records).map(toCleanExportRow));
}

export function serializeCleanJson(records: LocalLedgerRecord[]): string {
  return JSON.stringify(activeRecords(records).map(toCleanExportRow), null, 2);
}

function recordsForKind(records: LocalLedgerRecord[], kind: LocalLedgerRecord["kind"]): LocalLedgerRecord[] {
  return activeRecords(records).filter((record) => record.kind === kind);
}

function numericAmount(value: string): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function createAccountSummaryRows(accounts: LocalAccount[], records: LocalLedgerRecord[]): AccountSummaryRow[] {
  const summary = new Map<string, AccountSummaryRow>(
    accounts.map((account) => [
      account.id,
      {
        account_id: account.id,
        account_name: account.name,
        currency: account.currency,
        opening_balance: 0,
        income_total: 0,
        expense_total: 0,
        refund_total: 0,
        fund_addition_total: 0,
        transfer_in_total: 0,
        transfer_out_total: 0,
        adjustment_total: 0,
        closing_balance: 0,
        record_count: 0,
      },
    ]),
  );

  for (const record of activeRecords(records)) {
    const source = summary.get(record.accountId);
    if (!source) {
      continue;
    }

    source.record_count = Number(source.record_count) + 1;
    const amount = numericAmount(record.amount);

    if (record.kind === "income") {
      source.income_total = Number(source.income_total) + amount;
    } else if (record.kind === "expense" || record.kind === "unresolved-expense") {
      source.expense_total = Number(source.expense_total) + amount;
    } else if (record.kind === "refund") {
      source.refund_total = Number(source.refund_total) + amount;
    } else if (record.kind === "fund-addition") {
      source.fund_addition_total = Number(source.fund_addition_total) + amount;
    } else if (record.kind === "adjustment") {
      source.adjustment_total = Number(source.adjustment_total) + amount;
    } else if (record.kind === "transfer") {
      source.transfer_out_total = Number(source.transfer_out_total) + amount;
      const destination = summary.get(record.transferAccountId);
      if (destination) {
        destination.transfer_in_total = Number(destination.transfer_in_total) + numericAmount(record.destinationAmount || record.amount);
        if (destination.account_id !== source.account_id) {
          destination.record_count = Number(destination.record_count) + 1;
        }
      }
    }
  }

  const balances = calculateAccountBalances(accounts, records);
  for (const balance of balances) {
    const row = summary.get(balance.id);
    if (row) {
      row.closing_balance = balance.balance;
    }
  }

  return [...summary.values()];
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(target: DataView, offset: number, value: number): void {
  target.setUint16(offset, value, true);
}

function writeUint32(target: DataView, offset: number, value: number): void {
  target.setUint32(offset, value >>> 0, true);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function createStoredZip(files: Record<string, string>): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const [path, content] of Object.entries(files)) {
    const name = encoder.encode(path);
    const data = encoder.encode(content);
    const checksum = crc32(data);
    const localHeader = new Uint8Array(30 + name.length);
    const localView = new DataView(localHeader.buffer);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, 0);
    writeUint32(localView, 14, checksum);
    writeUint32(localView, 18, data.length);
    writeUint32(localView, 22, data.length);
    writeUint16(localView, 26, name.length);
    localHeader.set(name, 30);
    localParts.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + name.length);
    const centralView = new DataView(centralHeader.buffer);
    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0);
    writeUint16(centralView, 10, 0);
    writeUint32(centralView, 16, checksum);
    writeUint32(centralView, 20, data.length);
    writeUint32(centralView, 24, data.length);
    writeUint16(centralView, 28, name.length);
    writeUint32(centralView, 42, offset);
    centralHeader.set(name, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + data.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 8, Object.keys(files).length);
  writeUint16(endView, 10, Object.keys(files).length);
  writeUint32(endView, 12, centralDirectory.length);
  writeUint32(endView, 16, offset);
  return concatBytes([...localParts, centralDirectory, end]);
}

export function createMultiTableExport(
  accounts: LocalAccount[],
  records: LocalLedgerRecord[],
  exportedAt = new Date().toISOString(),
): MultiTableExportBundle {
  const active = activeRecords(records);
  const byPath: Record<string, LocalLedgerRecord[]> = {
    "ledger/transactions.csv": active.filter((record) => record.kind === "expense" || record.kind === "income"),
    "ledger/transfers.csv": recordsForKind(records, "transfer"),
    "ledger/fund_additions.csv": recordsForKind(records, "fund-addition"),
    "ledger/refunds.csv": recordsForKind(records, "refund"),
    "ledger/unresolved_expenses.csv": recordsForKind(records, "unresolved-expense"),
    "ledger/adjustments.csv": recordsForKind(records, "adjustment"),
  };
  const summaryRows = createAccountSummaryRows(accounts, records);
  const dates = active.map((record) => record.localDate).sort();
  const recordCounts = Object.fromEntries(Object.entries(byPath).map(([path, rows]) => [path, rows.length]));
  recordCounts["reports/account_summary.csv"] = summaryRows.length;
  const manifest = {
    app: "MealLedger",
    schema_version: "v1",
    exported_at: exportedAt,
    user_id_hash: "local-only",
    export_mode: "multi-table" as const,
    date_range: { start: dates[0] ?? null, end: dates[dates.length - 1] ?? null },
    currency_modes: [...new Set([
      ...accounts.map((account) => account.currency),
      ...active.flatMap((record) => [record.currency, record.destinationCurrency].filter(Boolean)),
    ])].sort(),
    files: ["manifest.json", ...multiTablePaths],
    record_counts: recordCounts,
  };
  const files: Record<string, string> = {
    "manifest.json": JSON.stringify(manifest, null, 2),
  };
  for (const path of multiTablePaths) {
    files[path] = path === "reports/account_summary.csv"
      ? serializeRows(accountSummaryColumns, summaryRows)
      : serializeRows(cleanExportColumns, (byPath[path] ?? []).map(toCleanExportRow));
  }

  return { files, manifest, zip: createStoredZip(files) };
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function createMultiTableExportWithProgress(
  accounts: LocalAccount[],
  records: LocalLedgerRecord[],
  onProgress: ExportProgress,
  exportedAt = new Date().toISOString(),
): Promise<MultiTableExportBundle> {
  onProgress(0, "preparing");
  await yieldToBrowser();
  onProgress(records.length > 0 ? 25 : 40, "preparing");
  await yieldToBrowser();
  onProgress(60, "building");
  const bundle = createMultiTableExport(accounts, records, exportedAt);
  onProgress(100, "complete");
  return bundle;
}
