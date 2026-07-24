import type { LocalAuditEvent, LocalLedgerRecord } from "../manualLedger/records";

export function rebindLocalWorkspace(
  records: LocalLedgerRecord[],
  auditEvents: LocalAuditEvent[],
  userId: string,
): { records: LocalLedgerRecord[]; auditEvents: LocalAuditEvent[] } {
  if (!userId.trim()) {
    return { records, auditEvents };
  }

  return {
    records: records.map((record) => record.userId === userId ? record : { ...record, userId }),
    auditEvents: auditEvents.map((event) => event.userId === userId ? event : { ...event, userId }),
  };
}
