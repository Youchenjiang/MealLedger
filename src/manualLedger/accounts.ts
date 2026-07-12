export type LocalAccount = {
  id: string;
  name: string;
  currency: string;
};

export function createLocalAccount(name: string, currency: string, id: string): LocalAccount | null {
  const normalizedName = name.trim();

  if (!normalizedName || !currency.trim()) {
    return null;
  }

  return { id, name: normalizedName, currency: currency.trim() };
}
