import { describe, expect, test, vi } from "vitest";
import { MAX_MEDIA_BYTES, MAX_MEDIA_FILES, queueUploadFiles, requestSignedUpload, validateMediaBatch } from "./upload";

describe("media upload boundary", () => {
  test("enforces file count and total byte limits", () => {
    expect(validateMediaBatch(Array.from({ length: MAX_MEDIA_FILES + 1 }, (_, index) => ({ name: `${index}.jpg`, type: "image/jpeg", size: 1 })))).toEqual(
      expect.objectContaining({ ok: false }),
    );
    expect(validateMediaBatch([{ name: "large.jpg", type: "image/jpeg", size: MAX_MEDIA_BYTES + 1 }])).toEqual(
      expect.objectContaining({ ok: false }),
    );
    expect(validateMediaBatch([{ name: "ok.jpg", type: "image/jpeg", size: 10 }])).toEqual(expect.objectContaining({ ok: true, totalBytes: 10 }));
  });

  test("creates stable local queue items", () => {
    expect(queueUploadFiles([{ name: "meal.jpg", type: "image/jpeg", size: 10 }], "meal-1")).toEqual([
      { id: "meal-1-0-meal.jpg", name: "meal.jpg", type: "image/jpeg", size: 10, status: "queued" },
    ]);
  });

  test("keeps the media intent on queued metadata", () => {
    expect(queueUploadFiles([{ name: "lunch.jpg", type: "image/jpeg", size: 10 }], "meal-1", "meal-photo")).toEqual([
      expect.objectContaining({ id: "meal-1-0-lunch.jpg", kind: "meal-photo", status: "queued" }),
    ]);
  });

  test("requests a short-lived upload without accepting a public URL", async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { mediaId: "media-1", putUrl: "https://upload.test", objectKey: "user/originals/media-1.jpg", expiresInSeconds: 900 },
      error: null,
    });
    const result = await requestSignedUpload({ functions: { invoke } }, { contentType: "image/jpeg", kind: "receipt-scan" });

    expect(result).toEqual({ ok: true, value: expect.objectContaining({ mediaId: "media-1", expiresInSeconds: 900 }) });
    expect(invoke).toHaveBeenCalledWith("create-r2-upload-url", { body: { contentType: "image/jpeg", kind: "receipt-scan", capturedAt: null } });
    expect(JSON.stringify(result)).not.toContain("publicUrl");
  });
});
