import { describe, expect, test } from "vitest";
import { createTemporaryScan, discardTemporaryScan, expireTemporaryScans, retainTemporaryScan } from "./media";

describe("temporary scan lifecycle", () => {
  const now = new Date("2026-07-13T00:00:00.000Z");

  test("creates a temporary source that expires after the configured TTL", () => {
    const scan = createTemporaryScan({ intent: "scan-receipt", fileName: "receipt.jpg", mimeType: "image/jpeg", byteSize: 120 }, "scan-1", now);

    expect(scan).toEqual(expect.objectContaining({ state: "temporary", intent: "scan-receipt", expiresAt: "2026-07-14T00:00:00.000Z" }));
    if (!scan) throw new Error("Expected a valid temporary scan.");
    expect(expireTemporaryScans([scan], new Date("2026-07-14T00:00:01.000Z"))[0].state).toBe("expired");
  });

  test("retaining or discarding a scan stops temporary expiration", () => {
    const scan = createTemporaryScan({ intent: "scan-invoice", fileName: "invoice.png", mimeType: "image/png", byteSize: 12 }, "scan-2", now);
    if (!scan) throw new Error("Expected a valid temporary scan.");

    expect(retainTemporaryScan(scan)).toEqual(expect.objectContaining({ state: "retained", expiresAt: null, cloudStatus: "local-only" }));
    expect(discardTemporaryScan(scan)).toEqual(expect.objectContaining({ state: "discarded", cloudStatus: "local-only" }));
  });

  test("rejects nameless or invalid sources", () => {
    expect(createTemporaryScan({ intent: "scan-receipt", fileName: "", mimeType: "image/jpeg", byteSize: 1 }, "scan-3", now)).toBeNull();
    expect(createTemporaryScan({ intent: "scan-receipt", fileName: "receipt.jpg", mimeType: "image/jpeg", byteSize: -1 }, "scan-4", now)).toBeNull();
  });
});
