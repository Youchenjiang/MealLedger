export const captureIntents = [
  { id: "manual-ledger", label: "Manual ledger", detail: "Save an expense, income, transfer, refund, or adjustment.", kind: "ledger" },
  { id: "scan-invoice", label: "Scan invoice", detail: "Keep an invoice scan as a reviewable source before ledger confirmation.", kind: "scan" },
  { id: "scan-receipt", label: "Scan receipt", detail: "Keep a receipt scan as a reviewable source before ledger confirmation.", kind: "scan" },
  { id: "record-meal", label: "Record meal", detail: "Record a meal with optional photos and an optional ledger link.", kind: "meal" },
  { id: "attach-photo", label: "Attach photo", detail: "Keep supporting evidence separate from clean ledger exports.", kind: "attachment" },
] as const;

export type CaptureIntent = (typeof captureIntents)[number]["id"];

export function captureIntentLabel(intent: CaptureIntent): string {
  return captureIntents.find((item) => item.id === intent)?.label ?? "Capture";
}
