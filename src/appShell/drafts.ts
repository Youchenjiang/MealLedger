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

function canCreateNormalizedDraft(form: DraftForm): boolean {
  if (!form.date || !form.account || !form.category || !form.counterparty || !form.amount) {
    return false;
  }

  return form.kind !== "transfer" || Boolean(form.transferAccount);
}

export function canCreateManualDraft(form: DraftForm): boolean {
  return canCreateNormalizedDraft(normalizeDraftForm(form));
}

export function createTransactionDraft(form: DraftForm, id: string): TransactionDraft | null {
  const normalized = normalizeDraftForm(form);

  if (!canCreateNormalizedDraft(normalized)) {
    return null;
  }

  return { id, ...normalized };
}
