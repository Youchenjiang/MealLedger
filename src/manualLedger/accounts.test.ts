import { describe, expect, test } from "vitest";
import { createLocalAccount } from "./accounts";

describe("local account setup", () => {
  test("trims a new account before it is available to entry forms", () => {
    expect(createLocalAccount("  Daily wallet  ", "TWD", "account-1")).toEqual({
      id: "account-1",
      name: "Daily wallet",
      currency: "TWD",
    });
  });

  test("rejects blank account names and currencies", () => {
    expect(createLocalAccount("   ", "TWD", "account-1")).toBeNull();
    expect(createLocalAccount("Daily wallet", "   ", "account-1")).toBeNull();
  });
});
