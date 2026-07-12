import type { LocalAccount } from "./accounts";
import type { LocalLedgerRecord } from "./records";

export type AccountBalance = LocalAccount & {
  balance: number;
};

function isActive(record: LocalLedgerRecord): boolean {
  return record.recordState !== "voided";
}

function numericAmount(value: string): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function applyRecordBalance(record: LocalLedgerRecord, balances: Map<string, number>): void {
  if (!isActive(record)) {
    return;
  }

  const sourceAmount = numericAmount(record.amount);
  const sourceSign = record.kind === "expense" || record.kind === "unresolved-expense" ? -1 : 1;

  if (record.kind === "transfer") {
    balances.set(record.accountId, (balances.get(record.accountId) ?? 0) - sourceAmount);
    const destinationAmount = numericAmount(record.destinationAmount || record.amount);
    if (record.transferAccountId) {
      balances.set(record.transferAccountId, (balances.get(record.transferAccountId) ?? 0) + destinationAmount);
    }
    return;
  }

  balances.set(record.accountId, (balances.get(record.accountId) ?? 0) + sourceAmount * sourceSign);
}

export function calculateAccountBalances(
  accounts: LocalAccount[],
  records: LocalLedgerRecord[],
): AccountBalance[] {
  const balances = new Map(accounts.map((account) => [account.id, 0]));

  for (const record of records) {
    applyRecordBalance(record, balances);
  }

  return accounts.map((account) => ({
    ...account,
    balance: balances.get(account.id) ?? 0,
  }));
}

export function formatAccountBalance(balance: number, currency: string): string {
  return `${currency} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(balance)}`;
}
