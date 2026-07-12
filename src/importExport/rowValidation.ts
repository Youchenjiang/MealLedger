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
  const match = /^(\d{4})[-/](\d{2})[-/](\d{2})$/.exec(value.trim());
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

  return `${match[1]}-${match[2]}-${match[3]}`;
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
  return rows.map((input, index) => {
    const normalized: NormalizedImportRow = Object.fromEntries(
      Object.entries(input).map(([key, value]) => [key, value?.trim() ?? ""]),
    ) as NormalizedImportRow;
    const errors: string[] = [];
    const kind = text(normalized, "kind") as ManualRecordKind;
    const account = validateAccount(normalized, accounts, errors);
    const sourceCurrency = text(normalized, "currency") || account?.currency || "";
    const rawAmount = text(normalized, "amount");
    const parsedAmount = normalizeAmount(rawAmount);
    let amount = "";
    if (kind === "adjustment") {
      if (parsedAmount === null || Number(parsedAmount) === 0) {
        errors.push("Adjustment amount must be a non-zero number.");
      } else {
        amount = parsedAmount;
      }
    } else {
      amount = positiveAmount(rawAmount, "Amount", errors);
    }

    if (!text(normalized, "currency") && account) {
      normalized.currency = account.currency;
    }
    if (amount) {
      normalized.amount = amount;
    }
    if (sourceCurrency && amount) {
      validatePrecision(amount, sourceCurrency, errors);
    }

    if (!supportedKinds.has(kind)) {
      errors.push("Kind is required and must be a supported ledger kind.");
    } else if (kind === "expense") {
      normalized.date = validateDate(normalized, errors);
      required(normalized, "category", "Category", errors);
      required(normalized, "merchant", "Merchant", errors);
      required(normalized, "item_name", "Item name", errors);
    } else if (kind === "income") {
      normalized.date = validateDate(normalized, errors);
      required(normalized, "category", "Category", errors);
      required(normalized, "source", "Source", errors);
    } else if (kind === "fund-addition") {
      normalized.date = validateDate(normalized, errors);
      required(normalized, "source", "Source", errors);
    } else if (kind === "adjustment") {
      normalized.date = validateDate(normalized, errors);
      required(normalized, "reason", "Reason", errors);
      if (amount && Number(amount) === 0) {
        errors.push("Adjustment amount cannot be zero.");
      }
    } else if (kind === "refund") {
      normalized.date = validateDate(normalized, errors);
      required(normalized, "category", "Category", errors);
      required(normalized, "merchant", "Merchant or source", errors);
      required(normalized, "refund_reason", "Refund reason", errors);
      if (text(normalized, "refund_subtype") === "payback" && !text(normalized, "refund_linked_record_id")) {
        errors.push("Payback requires a linked expense.");
      }
    } else if (kind === "transfer") {
      normalized.date = validateDate(normalized, errors);
      const targetAccountName = required(normalized, "target_account", "Target account", errors);
      const targetAccount = accountFor(accounts, targetAccountName);
      if (targetAccountName && !targetAccount) {
        errors.push(`Target account '${targetAccountName}' does not exist.`);
      }
      if (account && targetAccount && account.name === targetAccount.name) {
        errors.push("Source and target accounts must be different.");
      }

      const targetCurrency = text(normalized, "target_currency") || targetAccount?.currency || "";
      const isCrossCurrency = Boolean(targetAccount && account && targetAccount.currency !== account.currency);
      if (isCrossCurrency) {
        normalized.target_amount = positiveAmount(text(normalized, "target_amount"), "Target amount", errors);
        required(normalized, "target_currency", "Target currency", errors);
        if (targetCurrency && targetAccount && targetCurrency !== targetAccount.currency) {
          errors.push("Target currency must match the target account currency.");
        }
      } else if (targetAccount) {
        normalized.target_amount = text(normalized, "target_amount") || amount;
        normalized.target_currency = targetAccount.currency;
      }
    } else if (kind === "unresolved-expense") {
      const precision = required(normalized, "time_precision", "Time precision", errors);
      if (precision === "day") {
        normalized.date = validateDate(normalized, errors);
      } else if (precision === "month" || precision === "period") {
        const start = required(normalized, "period_start", "Period start", errors);
        const end = required(normalized, "period_end", "Period end", errors);
        const normalizedStart = normalizeDate(start);
        const normalizedEnd = normalizeDate(end);
        if (start && !normalizedStart) {
          errors.push("Period start must use YYYY-MM-DD or YYYY/MM/DD.");
        }
        if (end && !normalizedEnd) {
          errors.push("Period end must use YYYY-MM-DD or YYYY/MM/DD.");
        }
        if (normalizedStart && normalizedEnd && normalizedStart > normalizedEnd) {
          errors.push("Period start must not be after period end.");
        }
        normalized.period_start = normalizedStart ?? start;
        normalized.period_end = normalizedEnd ?? end;
      } else if (precision) {
        errors.push("Time precision must be day, month, or period.");
      }
    }

    return { rowNumber: index + 2, ok: errors.length === 0, normalized, errors };
  });
}
