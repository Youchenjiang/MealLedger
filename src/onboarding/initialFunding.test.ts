import { describe, expect, test } from "vitest";
import { createInitialFundingDraft } from "./initialFunding";
import { createLocalAccount } from "../manualLedger/accounts";
import { createOfficialRecordBundle } from "../manualLedger/records";

describe("initial funding", () => {
  test("creates a fund-addition draft instead of income", () => {
    const draft = createInitialFundingDraft(
      { account: "  Daily wallet ", amount: "1200", currency: "TWD", date: "2026-07-13" },
      "fund-1",
    );

    expect(draft).toEqual(expect.objectContaining({
      id: "fund-1",
      kind: "fund-addition",
      account: "Daily wallet",
      amount: "1200",
      counterparty: "Initial funds",
    }));
  });

  test("rejects empty or non-positive balances", () => {
    expect(createInitialFundingDraft({ account: "", amount: "100", currency: "TWD", date: "2026-07-13" }, "fund-1")).toBeNull();
    expect(createInitialFundingDraft({ account: "Wallet", amount: "0", currency: "TWD", date: "2026-07-13" }, "fund-2")).toBeNull();
    expect(createInitialFundingDraft({ account: "Wallet", amount: "abc", currency: "TWD", date: "2026-07-13" }, "fund-3")).toBeNull();
  });

  test("can be posted as an official local fund-addition record", () => {
    const account = createLocalAccount("Wallet", "TWD", "account-1", "cash", true);
    const draft = createInitialFundingDraft({ account: "Wallet", amount: "2500", currency: "TWD", date: "2026-07-13" }, "fund-1");

    expect(account).not.toBeNull();
    expect(draft).not.toBeNull();
    expect(createOfficialRecordBundle(draft!, [account!], {
      userId: "local-user",
      recordId: "record-fund-1",
      idempotencyKey: "onboarding:fund-1",
      createdAt: "2026-07-13T00:00:00.000Z",
    })).toEqual(expect.objectContaining({ records: expect.arrayContaining([expect.objectContaining({ kind: "fund-addition" })]) }));
  });
});
