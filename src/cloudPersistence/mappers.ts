import { parseMinorUnits } from "../manualLedger/money";
import type { LocalAccount } from "../manualLedger/accounts";
import type { LocalAuditEvent, LocalLedgerRecord } from "../manualLedger/records";
import type { TransactionDraft } from "../appShell/drafts";
import type {
  CloudMappingIssue,
  CloudMappingResult,
  CloudRecordBundle,
  CloudReferenceMap,
  CloudRow,
} from "./contracts";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return uuidPattern.test(value);
}

function issue(code: CloudMappingIssue["code"], field: string, message: string): CloudMappingIssue {
  return { code, field, message };
}

function reference(
  values: Record<string, string> | undefined,
  localId: string,
  field: string,
): CloudMappingResult<string> {
  const remoteId = values?.[localId] ?? (isUuid(localId) ? localId : undefined);
  return remoteId
    ? { ok: true, value: remoteId }
    : { ok: false, issues: [issue("missing-reference", field, `No cloud reference was resolved for ${localId}.`)] };
}

function money(value: string, currency: string, field: string, positive = false): CloudMappingResult<string> {
  const minorUnits = parseMinorUnits(value, currency);
  if (minorUnits === null || (positive && minorUnits <= 0n)) {
    return { ok: false, issues: [issue("invalid-money", field, `${field} is not valid for ${currency}.`)] };
  }
  return { ok: true, value: minorUnits.toString() };
}

function collect<T>(results: CloudMappingResult<T>[]): CloudMappingIssue[] {
  return results.flatMap((result) => result.ok ? [] : result.issues);
}

export function mapLocalAccount(account: LocalAccount, userId: string): CloudRow {
  return {
    ...(isUuid(account.id) ? { id: account.id } : {}),
    user_id: userId,
    name: account.name,
    currency: account.currency.toUpperCase(),
    account_type: account.accountType ?? "cash",
    allow_negative_balance: account.allowNegativeBalance ?? true,
  };
}

export function mapDraft(draft: TransactionDraft, userId: string): CloudRow {
  return {
    ...(isUuid(draft.id) ? { id: draft.id } : {}),
    user_id: userId,
    draft_type: "manual",
    state: "pending",
    candidate_json: draft,
  };
}

function mapAuditEvent(event: LocalAuditEvent): CloudRow {
  return {
    ...(isUuid(event.id) ? { id: event.id } : {}),
    user_id: event.userId,
    event_type: event.eventType,
    target_type: event.targetType,
    target_id: event.targetId,
    summary: event.summary,
    changes_json: { changedFields: event.changedFields },
    created_at: event.createdAt,
  };
}

export function mapLedgerRecord(
  record: LocalLedgerRecord,
  userId: string,
  references: CloudReferenceMap,
  timezone = "Asia/Taipei",
): CloudMappingResult<CloudRecordBundle> {
  const recordId = reference(references.ledgerRecordIds, record.id, "id");
  const accountId = reference(references.accountIds, record.accountId, "account_id");
  const amount = money(record.amount, record.currency, "amount", record.kind !== "adjustment");
  const issues = collect([recordId, accountId, amount]);

  const needsCategory = ["expense", "income", "refund"].includes(record.kind);
  const categoryId = record.category.trim() && needsCategory
    ? reference(references.categoryIds, record.category, "category_id")
    : { ok: true as const, value: undefined };
  if (!categoryId.ok) issues.push(...categoryId.issues);

  const eventId = record.event?.trim()
    ? reference(references.eventIds, record.event, "event_id")
    : { ok: true as const, value: undefined };
  if (!eventId.ok) issues.push(...eventId.issues);

  if (issues.length > 0 || !recordId.ok || !accountId.ok || !amount.ok) {
    return { ok: false, issues };
  }

  const isDay = record.timePrecision === "day";
  const ledgerRecord: CloudRow = {
    id: recordId.value,
    user_id: userId,
    kind: record.kind,
    record_state: record.recordState,
    local_date: isDay ? record.localDate : null,
    timezone,
    time_precision: record.timePrecision,
    period_start: isDay ? null : record.periodStart,
    period_end: isDay ? null : record.periodEnd,
    account_id: accountId.value,
    amount_minor: amount.value,
    currency: record.currency.toUpperCase(),
    category_id: categoryId.ok ? categoryId.value ?? null : null,
    merchant_text: record.counterparty || null,
    item_name: record.itemName || null,
    source: record.kind === "income" || record.kind === "fund-addition" ? record.counterparty || null : null,
    reason: record.reason || record.refundReason || null,
    event_id: eventId.ok ? eventId.value ?? null : null,
    source_label: record.sourceLabel || null,
    note: record.note || null,
    version: record.version,
    idempotency_key: record.idempotencyKey,
    voided_at: record.recordState === "voided" ? record.updatedAt : null,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };

  const bundle: CloudRecordBundle = {
    ledgerRecord,
    refundLinks: [],
    auditEvents: [],
  };

  if (record.kind === "transfer") {
    const destinationId = reference(references.accountIds, record.transferAccountId, "destination_account_id");
    const destinationAmount = money(
      record.destinationAmount || record.amount,
      record.destinationCurrency || record.currency,
      "destination_amount",
      true,
    );
    const transferIssues = collect([destinationId, destinationAmount]);
    if (transferIssues.length > 0 || !destinationId.ok || !destinationAmount.ok) {
      return { ok: false, issues: [...issues, ...transferIssues] };
    }
    bundle.transferDetails = {
      ledger_record_id: recordId.value,
      destination_account_id: destinationId.value,
      destination_amount_minor: destinationAmount.value,
      destination_currency: (record.destinationCurrency || record.currency).toUpperCase(),
    };
  }

  if (record.kind === "refund" && record.refundSubtype === "payback") {
    const allocations = references.refundAllocations?.[record.id];
    if (allocations && allocations.length > 0) {
      for (const allocation of allocations) {
        const originalId = reference(references.ledgerRecordIds, allocation.originalRecordId, "original_record_id");
        const linkedAmount = money(allocation.amount, allocation.currency, "refund_link.amount", true);
        const allocationIssues = collect([originalId, linkedAmount]);
        if (allocationIssues.length > 0 || !originalId.ok || !linkedAmount.ok) {
          issues.push(...allocationIssues);
          continue;
        }
        bundle.refundLinks.push({
          refund_record_id: recordId.value,
          original_record_id: originalId.value,
          amount_minor: linkedAmount.value,
          currency: allocation.currency.toUpperCase(),
          refund_subtype: "payback",
        });
      }
    } else {
      const linkedIds = record.refundLinkedRecordIds ?? (record.refundLinkedRecordId ? [record.refundLinkedRecordId] : []);
      if (linkedIds.length !== 1) {
        issues.push(issue("missing-refund-allocation", "refundLinkedRecordIds", "Multiple payback links require explicit per-record amounts."));
      } else {
        const originalId = reference(references.ledgerRecordIds, linkedIds[0], "original_record_id");
        if (!originalId.ok) {
          issues.push(...originalId.issues);
        } else {
          bundle.refundLinks.push({
            refund_record_id: recordId.value,
            original_record_id: originalId.value,
            amount_minor: amount.value,
            currency: record.currency.toUpperCase(),
            refund_subtype: "payback",
          });
        }
      }
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  bundle.auditEvents.push(mapAuditEvent({
    id: `cloud-audit-${record.id}`,
    userId,
    eventType: "record-created",
    targetType: "ledger-record",
    targetId: recordId.value,
    summary: `Persisted ${record.kind} record`,
    changedFields: ["kind", "amount", "account"],
    createdAt: record.updatedAt,
  }));

  return { ok: true, value: bundle };
}
