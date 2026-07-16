const zeroDecimalCurrencies = new Set(["TWD", "JPY"]);

export function currencyPrecision(currency: string): number {
  return zeroDecimalCurrencies.has(currency.trim().toUpperCase()) ? 0 : 2;
}

export function parseMinorUnits(value: string, currency: string): bigint | null {
  const normalized = value.trim().replace(/,/g, "");
  const precision = currencyPrecision(currency);
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) return null;

  const fraction = match[3] ?? "";
  if (fraction.length > precision) return null;

  const scale = 10n ** BigInt(precision);
  const fractionUnits = BigInt((fraction + "0".repeat(precision)).slice(0, precision) || "0");
  const units = BigInt(match[2]) * scale + fractionUnits;
  return match[1] === "-" ? -units : units;
}

export function isPositiveMoney(value: string, currency: string): boolean {
  const minorUnits = parseMinorUnits(value, currency);
  return minorUnits !== null && minorUnits > 0n;
}

export function isNonZeroMoney(value: string, currency: string): boolean {
  const minorUnits = parseMinorUnits(value, currency);
  return minorUnits !== null && minorUnits !== 0n;
}

export function minorUnitsToMajorNumber(minorUnits: bigint, currency: string): number {
  return Number(minorUnits) / 10 ** currencyPrecision(currency);
}
