export type ScanIntent = "scan-invoice" | "scan-receipt";
export type TemporaryScanState = "temporary" | "retained" | "discarded" | "expired";

export type TemporaryScan = {
  id: string;
  intent: ScanIntent;
  fileName: string;
  mimeType: string;
  byteSize: number;
  state: TemporaryScanState;
  cloudStatus?: "local-only" | "synced";
  createdAt: string;
  expiresAt: string | null;
};

export type TemporaryScanInput = {
  intent: ScanIntent;
  fileName: string;
  mimeType: string;
  byteSize: number;
};

export const TEMPORARY_SCAN_TTL_HOURS = 24;

export function createTemporaryScan(input: TemporaryScanInput, id: string, now = new Date()): TemporaryScan | null {
  const fileName = input.fileName.trim();
  if (!fileName || !input.intent || input.byteSize < 0 || !Number.isFinite(input.byteSize)) {
    return null;
  }

  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + TEMPORARY_SCAN_TTL_HOURS * 60 * 60 * 1000).toISOString();
  return {
    id,
    intent: input.intent,
    fileName,
    mimeType: input.mimeType.trim() || "application/octet-stream",
    byteSize: input.byteSize,
    state: "temporary",
    cloudStatus: "local-only",
    createdAt,
    expiresAt,
  };
}

export function retainTemporaryScan(scan: TemporaryScan): TemporaryScan {
  return { ...scan, state: "retained", expiresAt: null, cloudStatus: "local-only" };
}

export function discardTemporaryScan(scan: TemporaryScan): TemporaryScan {
  return { ...scan, state: "discarded", cloudStatus: "local-only" };
}

export function expireTemporaryScans(scans: TemporaryScan[], now = new Date()): TemporaryScan[] {
  return scans.map((scan) => (
    scan.state === "temporary" && scan.expiresAt && new Date(scan.expiresAt) <= now
      ? { ...scan, state: "expired", cloudStatus: "local-only" }
      : scan
  ));
}
