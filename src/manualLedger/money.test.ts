import { describe, expect, test } from "vitest";
import { isPositiveMoney, minorUnitsToMajorNumber, parseMinorUnits } from "./money";

describe("minor-unit money boundaries", () => {
  test("enforces currency precision", () => {
    expect(parseMinorUnits("100", "TWD")).toBe(100n);
    expect(parseMinorUnits("0.5", "TWD")).toBeNull();
    expect(parseMinorUnits("0.5", "JPY")).toBeNull();
    expect(parseMinorUnits("0.10", "USD")).toBe(10n);
    expect(parseMinorUnits("0.001", "USD")).toBeNull();
  });

  test("represents decimal arithmetic without floating point drift", () => {
    const total = (parseMinorUnits("0.1", "USD") ?? 0n) + (parseMinorUnits("0.2", "USD") ?? 0n);
    expect(minorUnitsToMajorNumber(total, "USD")).toBe(0.3);
    expect(isPositiveMoney("0.01", "USD")).toBe(true);
  });
});
