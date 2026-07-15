import type { LocalAccount } from "./accounts";
import { calculateAccountBalances } from "./balances";
import type { LocalLedgerRecord } from "./records";
import { minorUnitsToMajorNumber, parseMinorUnits } from "./money";

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

type MinorReportTotals = {
  incomeTotal: bigint;
  expenseTotal: bigint;
  refundTotal: bigint;
  fundAdditionTotal: bigint;
  transferInTotal: bigint;
  transferOutTotal: bigint;
  adjustmentTotal: bigint;
  netSpendingTotal: bigint;
  cashFlowTotal: bigint;
};

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

function emptyMinorTotals(): MinorReportTotals {
  return {
    incomeTotal: 0n,
    expenseTotal: 0n,
    refundTotal: 0n,
    fundAdditionTotal: 0n,
    transferInTotal: 0n,
    transferOutTotal: 0n,
    adjustmentTotal: 0n,
    netSpendingTotal: 0n,
    cashFlowTotal: 0n,
  };
}

function toReport(account: LocalAccount, totals: MinorReportTotals, recordCount: number, closingBalance: number): AccountReport {
  return {
    ...emptyReport(account),
    recordCount,
    incomeTotal: minorUnitsToMajorNumber(totals.incomeTotal, account.currency),
    expenseTotal: minorUnitsToMajorNumber(totals.expenseTotal, account.currency),
    refundTotal: minorUnitsToMajorNumber(totals.refundTotal, account.currency),
    fundAdditionTotal: minorUnitsToMajorNumber(totals.fundAdditionTotal, account.currency),
    transferInTotal: minorUnitsToMajorNumber(totals.transferInTotal, account.currency),
    transferOutTotal: minorUnitsToMajorNumber(totals.transferOutTotal, account.currency),
    adjustmentTotal: minorUnitsToMajorNumber(totals.adjustmentTotal, account.currency),
    netSpendingTotal: minorUnitsToMajorNumber(totals.netSpendingTotal, account.currency),
    cashFlowTotal: minorUnitsToMajorNumber(totals.cashFlowTotal, account.currency),
    closingBalance,
  };
}

type ReportAccumulator = {
  count: number;
  totals: MinorReportTotals;
};

function applyStandardReportTotals(
  source: ReportAccumulator,
  kind: LocalLedgerRecord["kind"],
  amount: bigint,
): void {
  if (kind === "income") {
    source.totals.incomeTotal += amount;
    source.totals.cashFlowTotal += amount;
    return;
  }
  if (kind === "expense" || kind === "unresolved-expense") {
    source.totals.expenseTotal += amount;
    source.totals.netSpendingTotal += amount;
    source.totals.cashFlowTotal -= amount;
    return;
  }
  if (kind === "refund") {
    source.totals.refundTotal += amount;
    source.totals.netSpendingTotal -= amount;
    source.totals.cashFlowTotal += amount;
    return;
  }
  if (kind === "fund-addition") {
    source.totals.fundAdditionTotal += amount;
    source.totals.cashFlowTotal += amount;
    return;
  }
  if (kind === "adjustment") {
    source.totals.adjustmentTotal += amount;
    source.totals.cashFlowTotal += amount;
  }
}

function applyTransferReportTotals(
  record: LocalLedgerRecord,
  source: ReportAccumulator,
  reports: Map<string, ReportAccumulator>,
  accountCurrencies: Map<string, string>,
  sourceMinor: bigint,
): void {
  source.totals.transferOutTotal += sourceMinor;
  source.totals.cashFlowTotal -= sourceMinor;

  const destination = reports.get(record.transferAccountId);
  if (!destination) return;
  const destinationCurrency = record.destinationCurrency || accountCurrencies.get(record.transferAccountId) || record.currency;
  const destinationMinor = parseMinorUnits(record.destinationAmount || record.amount, destinationCurrency);
  if (destinationMinor === null) return;
  destination.totals.transferInTotal += destinationMinor;
  destination.totals.cashFlowTotal += destinationMinor;
  if (record.transferAccountId !== record.accountId) destination.count += 1;
}

function applyReportRecord(
  record: LocalLedgerRecord,
  source: ReportAccumulator,
  reports: Map<string, ReportAccumulator>,
  accountCurrencies: Map<string, string>,
): void {
  const sourceMinor = parseMinorUnits(record.amount, record.currency);
  if (sourceMinor === null) return;
  source.count += 1;
  if (record.kind === "transfer") {
    applyTransferReportTotals(record, source, reports, accountCurrencies, sourceMinor);
    return;
  }
  applyStandardReportTotals(source, record.kind, sourceMinor);
}

export function calculateAccountReports(
  accounts: LocalAccount[],
  records: LocalLedgerRecord[],
): AccountReport[] {
  const accountCurrencies = new Map(accounts.map((account) => [account.id, account.currency]));
  const reports = new Map<string, ReportAccumulator>(accounts.map((account) => [account.id, {
    count: 0,
    totals: emptyMinorTotals(),
  }]));

  for (const record of records) {
    if (!active(record)) {
      continue;
    }

    const source = reports.get(record.accountId);
    if (!source) {
      continue;
    }

    applyReportRecord(record, source, reports, accountCurrencies);
  }

  const balances = calculateAccountBalances(accounts, records);
  const closingBalances = new Map(balances.map((balance) => [balance.id, balance.balance]));
  return accounts.map((account) => {
    const report = reports.get(account.id);
    return toReport(account, report?.totals ?? emptyMinorTotals(), report?.count ?? 0, closingBalances.get(account.id) ?? 0);
  });
}
