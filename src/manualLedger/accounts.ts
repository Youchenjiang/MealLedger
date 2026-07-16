export type LocalAccount = {
  id: string;
  name: string;
  currency: string;
  accountType?: string;
  allowNegativeBalance?: boolean;
};

export function createLocalAccount(
  name: string,
  currency: string,
  id: string,
  accountType?: string,
  allowNegativeBalance?: boolean,
): LocalAccount | null {
  const normalizedName = name.trim();

  if (!normalizedName || !currency.trim()) {
    return null;
  }

  return {
    id,
    name: normalizedName,
    currency: currency.trim(),
    ...(accountType ? { accountType: accountType.trim() } : {}),
    ...(allowNegativeBalance === undefined ? {} : { allowNegativeBalance }),
  };
}
