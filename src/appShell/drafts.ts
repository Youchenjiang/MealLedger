export const draftKinds = ["expense", "income", "transfer", "refund", "adjustment"] as const;

export type DraftKind = (typeof draftKinds)[number];

export type DraftForm = {
  date: string;
  account: string;
  kind: DraftKind;
  category: string;
  counterparty: string;
  transferAccount: string;
  amount: string;
  currency: string;
  note: string;
};

export type TransactionDraft = DraftForm & {
  id: string;
};

export function normalizeDraftForm(form: DraftForm): DraftForm {
  return {
    ...form,
    date: form.date.trim(),
    account: form.account.trim(),
    category: form.category.trim(),
    counterparty: form.counterparty.trim(),
    transferAccount: form.transferAccount.trim(),
    amount: form.amount.trim(),
    currency: form.currency.trim(),
    note: form.note.trim(),
  };
}

export function canCreateManualDraft(form: DraftForm): boolean {
  const normalized = normalizeDraftForm(form);

  if (!normalized.date || !normalized.account || !normalized.category || !normalized.counterparty || !normalized.amount) {
    return false;
  }

  return normalized.kind !== "transfer" || Boolean(normalized.transferAccount);
}

export function createTransactionDraft(form: DraftForm, id: string): TransactionDraft | null {
  const normalized = normalizeDraftForm(form);

  if (!canCreateManualDraft(normalized)) {
    return null;
  }

  return { id, ...normalized };
}
