import type { LocalAccount } from "./accounts";
import { calculateAccountBalances } from "./balances";
import type { LocalLedgerRecord } from "./records";

export type AccountReport = LocalAccount & {
  recordCount: number;
  incomeTotal: number;
  expenseTotal: number;
  refundTotal: number;
  fundAdditionTotal: number;
  transferInTotal: number;
  transferOutTotal: number;
  adjustmentTotal: number;
  netSpendingTotal: number;
  cashFlowTotal: number;
  closingBalance: number;
};

function amount(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function active(record: LocalLedgerRecord): boolean {
  return record.recordState !== "voided";
}

function emptyReport(account: LocalAccount): AccountReport {
  return {
    ...account,
    recordCount: 0,
    incomeTotal: 0,
    expenseTotal: 0,
    refundTotal: 0,
    fundAdditionTotal: 0,
    transferInTotal: 0,
    transferOutTotal: 0,
    adjustmentTotal: 0,
    netSpendingTotal: 0,
    cashFlowTotal: 0,
    closingBalance: 0,
  };
}

export function calculateAccountReports(
  accounts: LocalAccount[],
  records: LocalLedgerRecord[],
): AccountReport[] {
  const reports = new Map(accounts.map((account) => [account.id, emptyReport(account)]));

  for (const record of records) {
    if (!active(record)) {
      continue;
    }

    const source = reports.get(record.accountId);
    if (!source) {
      continue;
    }

    const sourceAmount = amount(record.amount);
    source.recordCount += 1;

    switch (record.kind) {
      case "income":
        source.incomeTotal += sourceAmount;
        source.cashFlowTotal += sourceAmount;
        break;
      case "expense":
      case "unresolved-expense":
        source.expenseTotal += sourceAmount;
        source.netSpendingTotal += sourceAmount;
        source.cashFlowTotal -= sourceAmount;
        break;
      case "refund":
        source.refundTotal += sourceAmount;
        source.netSpendingTotal -= sourceAmount;
        source.cashFlowTotal += sourceAmount;
        break;
      case "fund-addition":
        source.fundAdditionTotal += sourceAmount;
        source.cashFlowTotal += sourceAmount;
        break;
      case "adjustment":
        source.adjustmentTotal += sourceAmount;
        source.cashFlowTotal += sourceAmount;
        break;
      case "transfer": {
        source.transferOutTotal += sourceAmount;
        source.cashFlowTotal -= sourceAmount;
        const destination = reports.get(record.transferAccountId);
        if (destination) {
          const destinationAmount = amount(record.destinationAmount || record.amount);
          destination.transferInTotal += destinationAmount;
          destination.cashFlowTotal += destinationAmount;
        }
        break;
      }
    }
  }

  const balances = calculateAccountBalances(accounts, records);
  for (const balance of balances) {
    const report = reports.get(balance.id);
    if (report) {
      report.closingBalance = balance.balance;
    }
  }

  return [...reports.values()];
}
