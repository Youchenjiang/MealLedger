import { describe, expect, test } from "vitest";
import { captureIntentLabel, captureIntents } from "./intents";

describe("capture intents", () => {
  test("exposes the five capture entry points", () => {
    expect(captureIntents.map((item) => item.id)).toEqual([
      "manual-ledger",
      "scan-invoice",
      "scan-receipt",
      "record-meal",
      "attach-photo",
    ]);
  });

  test("provides a stable label for each entry point", () => {
    expect(captureIntentLabel("record-meal")).toBe("Record meal");
  });
});
