import { describe, expect, test } from "vitest";
import { classifyCloudError, nextRetryAt } from "./retry";

describe("cloud retry policy", () => {
  test("does not retry ownership or validation errors", () => {
    expect(classifyCloudError({ message: "denied", code: "42501" }, "ledger_records")).toMatchObject({ code: "ownership", retryable: false });
    expect(classifyCloudError({ message: "invalid", code: "23514" }, "ledger_records")).toMatchObject({ code: "validation", retryable: false });
  });

  test("uses bounded exponential retry delays", () => {
    const now = new Date("2026-07-13T00:00:00.000Z");
    expect(nextRetryAt(1, now)).toBe("2026-07-13T00:00:01.000Z");
    expect(nextRetryAt(2, now)).toBe("2026-07-13T00:00:02.000Z");
    expect(nextRetryAt(4, now)).toBe("2026-07-13T00:00:08.000Z");
    expect(nextRetryAt(5, now, 5)).toBeNull();
  });
});
