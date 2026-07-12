export const MAX_MEDIA_FILES = 20;
export const MAX_MEDIA_BYTES = 100 * 1024 * 1024;

export type UploadFileLike = {
  name: string;
  type: string;
  size: number;
};

export type UploadQueueItem = UploadFileLike & {
  id: string;
  status: "queued" | "local-only" | "uploaded" | "failed";
};

export type UploadBatchValidation = {
  ok: boolean;
  totalBytes: number;
  error?: string;
};

export function validateMediaBatch(files: readonly UploadFileLike[]): UploadBatchValidation {
  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  if (files.length > MAX_MEDIA_FILES) {
    return { ok: false, totalBytes, error: `Select at most ${MAX_MEDIA_FILES} files at a time.` };
  }

  if (totalBytes > MAX_MEDIA_BYTES) {
    return { ok: false, totalBytes, error: "The selected files exceed the 100 MB batch limit." };
  }

  return { ok: true, totalBytes };
}

export function queueUploadFiles(files: readonly UploadFileLike[], prefix: string): UploadQueueItem[] {
  return files.map((file, index) => ({ ...file, id: `${prefix}-${index}-${file.name}`, status: "queued" }));
}

export type SignedUploadClient = {
  functions: {
    invoke: (name: string, options: { body: Record<string, unknown> }) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
};

export type SignedUploadResult = {
  mediaId: string;
  putUrl: string;
  objectKey: string;
  expiresInSeconds: number;
};

export async function requestSignedUpload(
  client: SignedUploadClient,
  input: { contentType: string; kind: "meal-photo" | "receipt-scan" | "invoice-scan" | "attachment"; capturedAt?: string },
): Promise<{ ok: true; value: SignedUploadResult } | { ok: false; error: string }> {
  const { data, error } = await client.functions.invoke("create-r2-upload-url", {
    body: { contentType: input.contentType, kind: input.kind, capturedAt: input.capturedAt ?? null },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data || typeof data !== "object" || !("mediaId" in data) || !("putUrl" in data) || !("objectKey" in data) || !("expiresInSeconds" in data)) {
    return { ok: false, error: "The upload boundary returned an invalid response." };
  }

  return { ok: true, value: data as SignedUploadResult };
}
