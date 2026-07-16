import type { ManualRecordKind } from "../manualLedger/kinds";
import type { NormalizedImportField } from "./mapping";

export type NormalizedImportRow = Partial<Record<NormalizedImportField, string>>;

export type ImportAccount = {
  name: string;
  currency: string;
};

export type ImportRowValidation = {
  rowNumber: number;
  ok: boolean;
  normalized: NormalizedImportRow;
  errors: string[];
};

const supportedKinds = new Set<ManualRecordKind>([
  "expense",
  "income",
  "transfer",
  "refund",
  "fund-addition",
  "adjustment",
  "unresolved-expense",
]);

function text(row: NormalizedImportRow, field: NormalizedImportField): string {
  return row[field]?.trim() ?? "";
}

function required(row: NormalizedImportRow, field: NormalizedImportField, label: string, errors: string[]): string {
  const value = text(row, field);
  if (!value) {
    errors.push(`${label} is required.`);
  }
  return value;
}

function normalizeDate(value: string): string | null {
  const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return `${match[1]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeAmount(value: string): string | null {
  const cleaned = value.replace(/[,$\s]/g, "");
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? cleaned : null;
}

function validatePrecision(amount: string, currency: string, errors: string[]): void {
  const precision = currency === "TWD" || currency === "JPY" ? 0 : 2;
  const fractionalDigits = amount.split(".")[1]?.length ?? 0;
  if (fractionalDigits > precision) {
    errors.push(`${currency} supports at most ${precision} decimal places.`);
  }
}

function positiveAmount(amount: string, label: string, errors: string[]): string {
  const normalized = normalizeAmount(amount);
  if (normalized === null || Number(normalized) <= 0) {
    errors.push(`${label} must be greater than zero.`);
    return "";
  }
  return normalized;
}

function accountFor(accounts: ImportAccount[], name: string): ImportAccount | undefined {
  return accounts.find((account) => account.name === name);
}

function validateAccount(row: NormalizedImportRow, accounts: ImportAccount[], errors: string[]): ImportAccount | undefined {
  const name = required(row, "account", "Account", errors);
  const account = accountFor(accounts, name);
  if (name && !account) {
    errors.push(`Account '${name}' does not exist.`);
  }
  return account;
}

function validateDate(row: NormalizedImportRow, errors: string[]): string {
  const value = required(row, "date", "Date", errors);
  if (!value) {
    return "";
  }
  const normalized = normalizeDate(value);
  if (!normalized) {
    errors.push("Date must use YYYY-MM-DD or YYYY/MM/DD.");
    return "";
  }
  return normalized;
}

export function validateImportRows(rows: NormalizedImportRow[], accounts: ImportAccount[]): ImportRowValidation[] {
  return rows.map((input, index) => validateImportRow(input, index, accounts));
}

function validateImportRow(input: NormalizedImportRow, index: number, accounts: ImportAccount[]): ImportRowValidation {
  const normalized: NormalizedImportRow = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, value?.trim() ?? ""])) as NormalizedImportRow;
  const errors: string[] = [];
  const kind = text(normalized, "kind") as ManualRecordKind;
  const account = validateAccount(normalized, accounts, errors);
  const amount = normalizeImportAmount(normalized, kind, account, errors);
  if (amount) normalized.amount = amount;
  validateKindFields(normalized, kind, account, accounts, amount, errors);
  validateImportFees(normalized, kind, accounts, errors);
  return { rowNumber: index + 2, ok: errors.length === 0, normalized, errors };
}

function normalizeImportAmount(normalized: NormalizedImportRow, kind: ManualRecordKind, account: ImportAccount | undefined, errors: string[]): string {
  if (!text(normalized, "currency") && account) normalized.currency = account.currency;
  const currency = text(normalized, "currency") || account?.currency || "";
  const rawAmount = text(normalized, "amount");
  const parsedAmount = normalizeAmount(rawAmount);
  const amount = kind === "adjustment" ? parsedAmount ?? "" : positiveAmount(rawAmount, "Amount", errors);
  if (kind === "adjustment" && (parsedAmount === null || Number(parsedAmount) === 0)) errors.push("Adjustment amount must be a non-zero number.");
  if (currency && amount) validatePrecision(amount, currency, errors);
  return amount;
}

function validateKindFields(normalized: NormalizedImportRow, kind: ManualRecordKind, account: ImportAccount | undefined, accounts: ImportAccount[], amount: string, errors: string[]): void {
  if (!supportedKinds.has(kind)) {
    errors.push("Kind is required and must be a supported ledger kind.");
    return;
  }
  if (kind === "expense") {
    validateExpenseFields(normalized, errors);
    return;
  }
  if (kind === "income") {
    validateIncomeFields(normalized, errors);
    return;
  }
  if (kind === "fund-addition") {
    validateDateAndRequired(normalized, "source", "Source", errors);
    return;
  }
  if (kind === "adjustment") {
    validateAdjustmentFields(normalized, amount, errors);
    return;
  }
  if (kind === "refund") {
    validateRefundFields(normalized, errors);
    return;
  }
  if (kind === "transfer") {
    validateTransferFields(normalized, account, accounts, amount, errors);
    return;
  }
  validateUnresolvedExpenseFields(normalized, errors);
}

function validateExpenseFields(normalized: NormalizedImportRow, errors: string[]): void {
  validateDateAndRequired(normalized, "category", "Category", errors);
  required(normalized, "merchant", "Merchant", errors);
  required(normalized, "item_name", "Item name", errors);
}

function validateIncomeFields(normalized: NormalizedImportRow, errors: string[]): void {
  validateDateAndRequired(normalized, "category", "Category", errors);
  required(normalized, "source", "Source", errors);
}

function validateDateAndRequired(normalized: NormalizedImportRow, field: keyof NormalizedImportRow, label: string, errors: string[]): void {
  normalized.date = validateDate(normalized, errors);
  required(normalized, field, label, errors);
}

function validateAdjustmentFields(normalized: NormalizedImportRow, amount: string, errors: string[]): void {
  validateDateAndRequired(normalized, "reason", "Reason", errors);
  if (amount && Number(amount) === 0) errors.push("Adjustment amount cannot be zero.");
}

function validateRefundFields(normalized: NormalizedImportRow, errors: string[]): void {
  validateDateAndRequired(normalized, "category", "Category", errors);
  required(normalized, "merchant", "Merchant or source", errors);
  required(normalized, "refund_reason", "Refund reason", errors);
  const isPayback = text(normalized, "refund_subtype") === "payback";
  const hasLinkedExpense = Boolean(text(normalized, "refund_linked_record_ids") || text(normalized, "refund_linked_record_id"));
  if (isPayback && !hasLinkedExpense) errors.push("Payback requires a linked expense.");
}

function validateTransferFields(normalized: NormalizedImportRow, account: ImportAccount | undefined, accounts: ImportAccount[], amount: string, errors: string[]): void {
  normalized.date = validateDate(normalized, errors);
  const targetName = required(normalized, "target_account", "Target account", errors);
  const targetAccount = accountFor(accounts, targetName);
  if (targetName && !targetAccount) errors.push(`Target account '${targetName}' does not exist.`);
  if (account?.name && account.name === targetAccount?.name) errors.push("Source and target accounts must be different.");
  const targetCurrency = text(normalized, "target_currency") || targetAccount?.currency || "";
  const isCrossCurrency = Boolean(targetAccount && account && targetAccount.currency !== account.currency);
  if (isCrossCurrency) {
    normalized.target_amount = positiveAmount(text(normalized, "target_amount"), "Target amount", errors);
    required(normalized, "target_currency", "Target currency", errors);
    if (targetCurrency && targetAccount && targetCurrency !== targetAccount.currency) errors.push("Target currency must match the target account currency.");
  } else if (targetAccount) {
    normalized.target_amount = text(normalized, "target_amount") || amount;
    normalized.target_currency = targetAccount.currency;
  }
}

function validateUnresolvedExpenseFields(normalized: NormalizedImportRow, errors: string[]): void {
  const precision = required(normalized, "time_precision", "Time precision", errors);
  if (precision === "day") {
    normalized.date = validateDate(normalized, errors);
    return;
  }
  if (precision !== "month" && precision !== "period") {
    if (precision) errors.push("Time precision must be day, month, or period.");
    return;
  }
  const start = required(normalized, "period_start", "Period start", errors);
  const end = required(normalized, "period_end", "Period end", errors);
  const normalizedStart = normalizeDate(start);
  const normalizedEnd = normalizeDate(end);
  if (start && !normalizedStart) errors.push("Period start must use YYYY-MM-DD or YYYY/MM/DD.");
  if (end && !normalizedEnd) errors.push("Period end must use YYYY-MM-DD or YYYY/MM/DD.");
  if (normalizedStart && normalizedEnd && normalizedStart > normalizedEnd) errors.push("Period start must not be after period end.");
  normalized.period_start = normalizedStart ?? start;
  normalized.period_end = normalizedEnd ?? end;
}

function validateImportFees(normalized: NormalizedImportRow, kind: ManualRecordKind, accounts: ImportAccount[], errors: string[]): void {
  const feeFields = ["fee_account", "fee_amount", "fee_currency", "fee_category"] as const;
  if (!feeFields.some((field) => Boolean(text(normalized, field)))) return;
  if (kind !== "transfer") errors.push("Transfer fee fields are only valid for transfer rows.");
  const feeAccountName = required(normalized, "fee_account", "Fee account", errors);
  const feeAccount = accountFor(accounts, feeAccountName);
  if (feeAccountName && !feeAccount) errors.push(`Fee account '${feeAccountName}' does not exist.`);
  const feeCurrency = text(normalized, "fee_currency") || feeAccount?.currency || "";
  if (!text(normalized, "fee_currency") && feeAccount) normalized.fee_currency = feeAccount.currency;
  const feeAmount = positiveAmount(text(normalized, "fee_amount"), "Fee amount", errors);
  if (feeAmount) normalized.fee_amount = feeAmount;
  if (feeCurrency && feeAmount) validatePrecision(feeAmount, feeCurrency, errors);
  if (feeAccount && feeCurrency && feeAccount.currency !== feeCurrency) errors.push("Fee currency must match the fee account currency.");
  required(normalized, "fee_category", "Fee category", errors);
}
