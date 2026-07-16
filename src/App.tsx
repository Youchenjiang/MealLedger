import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, Dispatch, FormEvent, SetStateAction } from "react";
import {
  AlertCircle,
  Banknote,
  Camera,
  CheckCircle2,
  CloudOff,
  Home,
  ImagePlus,
  LogIn,
  LogOut,
  Plus,
  ReceiptText,
  Settings,
  ShieldCheck,
  Upload,
  Wifi,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { isLocalDevelopmentMode, isSupabaseConfigured, supabase } from "./lib/supabase";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import type { AppLocation, AppRoute, AuthState, NavItem } from "./types";
import { canAutoRecordNextCycle, createTransactionDraft, draftKinds, missingCounterpartyLabel, missingItemNameLabel, monthToPeriodRange, normalizeDraftForm, type DraftForm, type TransactionDraft } from "./appShell/drafts";
import { createLocalAccount, type LocalAccount } from "./manualLedger/accounts";
import { calculateAccountBalances, formatAccountBalance } from "./manualLedger/balances";
import { calculateAccountReports, type AccountReport } from "./manualLedger/reports";
import { appendIdempotentRecords, convertUnresolvedExpense, createOfficialRecordBundle, updateOfficialRecord, voidOfficialRecord, type EditableRecordFields, type LocalAuditEvent, type LocalLedgerRecord, type UnresolvedExpenseConversion } from "./manualLedger/records";
import { createMultiTableExportWithProgress, serializeCleanCsv, serializeCleanJson } from "./manualLedger/export";
import { validateCsvBytes } from "./importExport/csv";
import { mapImportHeaders, mapImportRow } from "./importExport/mapping";
import { validateImportRows, type ImportRowValidation, type NormalizedImportRow } from "./importExport/rowValidation";
import { categoryReviewSummary } from "./importExport/aliases";
import { toImportedTransactionDraft } from "./importExport/recordDraft";
import { detectImportDuplicates, type ImportDuplicate } from "./importExport/duplicates";
import { createInitialFundingDraft } from "./onboarding/initialFunding";
import { applyDefaultTaxonomy, type TaxonomyAliasSeed } from "./taxonomy/defaults";
import { captureIntentLabel, captureIntents, type CaptureIntent } from "./captureMedia/intents";
import { createMealEntry, type MealEntry } from "./captureMedia/meals";
import { createTemporaryScan, discardTemporaryScan, expireTemporaryScans, retainTemporaryScan, type TemporaryScan } from "./captureMedia/media";
import { queueUploadFiles, validateMediaBatch, type UploadQueueItem } from "./captureMedia/upload";
import { createSupabasePersistenceClient, createSupabaseReferenceBootstrapClient, type RawSupabaseClient } from "./cloudPersistence/supabaseClient";
import { enqueueRecordSync, retryCloudSyncItem, type CloudSyncQueueItem } from "./cloudPersistence/syncQueue";
import { enqueueLocalChanges, syncLocalChanges } from "./cloudPersistence/syncService";

const navItems: NavItem[] = [
  { route: "overview", label: "Overview", path: "/overview", icon: Home },
  { route: "ledger", label: "Ledger", path: "/ledger", icon: Banknote },
  { route: "capture", label: "Capture", path: "/capture", icon: Camera },
  { route: "settings", label: "Settings", path: "/settings", icon: Settings },
];

type RouteDefinition = {
  segments: string[];
  route: Exclude<AppRoute, "not-found">;
};

type ImportReviewItem = ImportRowValidation & {
  reviewId: string;
  aliasReview: string | null;
  duplicates: ImportDuplicate[];
  status: "pending" | "confirmed" | "skipped" | "failed" | "kept-separate" | "linked" | "merged";
};

type PhotoInput = FileList | File[] | null;
type QuickAccountField = "account" | "transferAccount" | "feeAccount";

const routeDefinitions: RouteDefinition[] = [
  { segments: [], route: "overview" },
  { segments: ["overview"], route: "overview" },
  { segments: ["ledger"], route: "ledger" },
  { segments: ["ledger", "draft", ":draftId"], route: "ledger" },
  { segments: ["capture"], route: "capture" },
  { segments: ["settings"], route: "settings" },
  { segments: ["settings", "localization"], route: "settings" },
];

function navItemFor(route: AppRoute): NavItem {
  return navItems.find((item) => item.route === route) ?? navItems[0];
}

function localDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function localDateTime(): string {
  return `${localDate()}T12:00`;
}

function countLabel(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function metricValue(count: number, noun: string, empty: string): string {
  return count > 0 ? `${count} ${noun}` : empty;
}

function metricDetail(count: number, populated: string, empty: string): string {
  return count > 0 ? populated : empty;
}

function timePrecisionLabel(precision: DraftForm["timePrecision"]): string {
  if (precision === "day") return "Day";
  if (precision === "month") return "Month";
  return "Period";
}

function selectedRefundIdsFor(form: DraftForm): string[] {
  if (form.refundLinkedRecordIds?.length) return form.refundLinkedRecordIds;
  return form.refundLinkedRecordId ? [form.refundLinkedRecordId] : [];
}

function missingExpenseFieldPatch(field: "counterparty" | "itemName", missing: boolean): Partial<DraftForm> {
  if (field === "counterparty") {
    return { counterpartyMissing: missing, counterparty: missing ? missingCounterpartyLabel : "" };
  }
  return { itemNameMissing: missing, itemName: missing ? missingItemNameLabel : "" };
}

function importStatus(kind: "confirmed" | "kept-separate" | "merged", imported: boolean): ImportReviewItem["status"] {
  return imported ? kind : "failed";
}

function exportStageMessage(stage: "preparing" | "building" | "complete"): string {
  if (stage === "complete") return "ZIP export ready.";
  if (stage === "building") return "Building ZIP export...";
  return "Preparing ZIP export...";
}

function duplicateCandidateName(duplicate: ImportDuplicate): string {
  return duplicate.candidateType === "existing-record"
    ? duplicate.candidateId
    : `row ${duplicate.candidateRowNumber}`;
}

function duplicateCandidateLabel(duplicate: ImportDuplicate): string {
  return `${duplicateCandidateName(duplicate)}: ${duplicate.reason}`;
}

function downloadTextFile(content: string, fileName: string, mimeType: string): void {
  const urlApi = window.URL;
  if (!urlApi.createObjectURL) {
    return;
  }

  const url = urlApi.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  urlApi.revokeObjectURL(url);
}

function downloadBinaryFile(content: Uint8Array, fileName: string, mimeType: string): void {
  const urlApi = window.URL;
  if (!urlApi.createObjectURL) {
    return;
  }

  const bytes = new Uint8Array(content.byteLength);
  bytes.set(content);
  const url = urlApi.createObjectURL(new Blob([bytes.buffer], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  urlApi.revokeObjectURL(url);
}

let draftSequence = 0;

const draftsStorageKey = "mealledger.app-shell.drafts";
const accountsStorageKey = "mealledger.manual-ledger.accounts";
const recordsStorageKey = "mealledger.manual-ledger.records";
const auditEventsStorageKey = "mealledger.manual-ledger.audit-events";
const categoriesStorageKey = "mealledger.manual-ledger.custom-categories";
const sourcesStorageKey = "mealledger.manual-ledger.custom-sources";
const onboardingStorageKey = "mealledger.onboarding.completed";
const tagsStorageKey = "mealledger.taxonomy.tags";
const aliasesStorageKey = "mealledger.taxonomy.aliases";
const mealsStorageKey = "mealledger.capture.meals";
const scansStorageKey = "mealledger.capture.temporary-scans";
const uploadQueueStorageKey = "mealledger.capture.upload-queue";
const cloudSyncQueueStorageKey = "mealledger.cloud-sync.queue";
const localDataOwnerStorageKey = "mealledger.local-data-owner";

function draftId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  draftSequence += 1;
  return `draft-${Date.now()}-${draftSequence}`;
}

function readStoredRecords(): LocalLedgerRecord[] {
  try {
    const stored = window.localStorage.getItem(recordsStorageKey);
    if (!stored) {
      return [];
    }

    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as LocalLedgerRecord[]) : [];
  } catch {
    return [];
  }
}

function readStoredAccounts(): LocalAccount[] {
  try {
    const stored = window.localStorage.getItem(accountsStorageKey);
    if (!stored) {
      return [];
    }

    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as LocalAccount[]) : [];
  } catch {
    return [];
  }
}

function readOnboardingCompleted(): boolean {
  try {
    return window.localStorage.getItem(onboardingStorageKey) === "true";
  } catch {
    return false;
  }
}

function readStoredLabels(key: string): string[] {
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) {
      return [];
    }

    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : [];
  } catch {
    return [];
  }
}

function readStoredAliases(): TaxonomyAliasSeed[] {
  try {
    const stored = window.localStorage.getItem(aliasesStorageKey);
    if (!stored) {
      return [];
    }

    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed)
      && parsed.every((item) => item && typeof item === "object" && "alias" in item && "canonical" in item)
      ? parsed as TaxonomyAliasSeed[]
      : [];
  } catch {
    return [];
  }
}

function readStoredMeals(): MealEntry[] {
  try {
    const stored = window.localStorage.getItem(mealsStorageKey);
    if (!stored) {
      return [];
    }

    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed as MealEntry[] : [];
  } catch {
    return [];
  }
}

function readStoredScans(): TemporaryScan[] {
  try {
    const stored = window.localStorage.getItem(scansStorageKey);
    if (!stored) {
      return [];
    }

    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed as TemporaryScan[] : [];
  } catch {
    return [];
  }
}

function readStoredUploadQueue(): UploadQueueItem[] {
  try {
    const stored = window.localStorage.getItem(uploadQueueStorageKey);
    if (!stored) {
      return [];
    }

    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed as UploadQueueItem[] : [];
  } catch {
    return [];
  }
}

function readStoredCloudSyncQueue(): CloudSyncQueueItem[] {
  try {
    const stored = window.localStorage.getItem(cloudSyncQueueStorageKey);
    if (!stored) return [];

    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed as CloudSyncQueueItem[] : [];
  } catch {
    return [];
  }
}

function readLocalDataOwner(): string {
  try {
    return window.localStorage.getItem(localDataOwnerStorageKey) ?? "";
  } catch {
    return "";
  }
}

function readStoredCategories(): string[] {
  try {
    const stored = window.localStorage.getItem(categoriesStorageKey);
    if (!stored) {
      return [];
    }

    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed as string[] : [];
  } catch {
    return [];
  }
}

function readStoredSources(): string[] {
  try {
    const stored = window.localStorage.getItem(sourcesStorageKey);
    if (!stored) {
      return [];
    }

    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed as string[] : [];
  } catch {
    return [];
  }
}

function readStoredAuditEvents(): LocalAuditEvent[] {
  try {
    const stored = window.localStorage.getItem(auditEventsStorageKey);
    if (!stored) {
      return [];
    }

    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as LocalAuditEvent[]) : [];
  } catch {
    return [];
  }
}

const expenseCategories = [
  "Daily",
  "Electronics",
  "Cleaning",
  "Transport",
  "Breakfast",
  "Lunch",
  "Dinner",
  "Clothing",
  "Learning",
  "Medical",
  "Stationery",
  "Entertainment",
  "Hiking",
  "Gift",
  "AI",
  "Fees",
];

const incomeCategories = ["Allowance", "Salary", "Interest", "Gift", "Reimbursement", "Prize", "Other income"];

function createEmptyDraftForm(): DraftForm {
  return {
    date: localDate(), account: "", kind: "expense", category: "", counterparty: "", counterpartyMissing: false,
    itemName: "", itemNameMissing: false, transferAccount: "", transferMode: "same-currency", amount: "", currency: "TWD",
    destinationAmount: "", destinationCurrency: "JPY", feeEnabled: false, feeAccount: "", feeAmount: "", feeCurrency: "TWD",
    feeCategory: "", refundReason: "", refundSubtype: "refund", refundLinkedRecordId: "", refundLinkedRecordIds: [], refundExcessHandling: "unclassified",
    recurrenceChoice: "current-cycle-only", recurrenceAmountMode: "fixed", reason: "", timePrecision: "day", periodStart: "",
    periodEnd: "", note: "",
  };
}

function draftDisplayName(draft: TransactionDraft): string {
  return draft.kind === "transfer" ? `${draft.account} to ${draft.transferAccount}` : draft.counterparty;
}

function recordDisplayName(record: LocalLedgerRecord): string {
  return record.kind === "transfer" ? `${record.accountName} to ${record.transferAccountName}` : record.counterparty || record.reason || record.kind;
}

function syncTargetLabel(target: CloudSyncQueueItem["target"]): string {
  switch (target) {
    case "record":
      return "ledger record";
    case "draft":
      return "ledger draft";
    case "meal":
      return "meal";
    case "media":
      return "media metadata";
    default:
      return "scan source";
  }
}

function formatAmountStep(step: number): string {
  if (step === 1000) {
    return "+1k";
  }
  if (step === -1000) {
    return "-1k";
  }
  return step > 0 ? `+${step}` : String(step);
}

function draftCountLabel(draftCount: number): string {
  if (draftCount === 0) {
    return "No drafts to review";
  }

  const noun = draftCount === 1 ? "draft" : "drafts";
  return `${draftCount} ${noun} waiting`;
}

function draftReviewCopy(draftCount: number): string {
  if (draftCount === 0) {
    return "Scans, imports, and cancelled entries will appear here before ledger confirmation.";
  }

  const noun = draftCount === 1 ? "draft" : "drafts";
  return `${draftCount} ${noun} waiting. Continue in Capture or confirm a complete draft here.`;
}

function formatAliasReviewMessage(items: Array<{ rowNumber: number; summary: string }>): string {
  return items.length === 0 ? "" : ` Category review: ${items.map((item) => `Row ${item.rowNumber}: ${item.summary}`).join(" ")}`;
}

function formatDuplicateReviewMessage(rowNumbers: number[]): string {
  return rowNumbers.length === 0 ? "" : ` Duplicate review: ${rowNumbers.map((rowNumber) => `Row ${rowNumber}`).join(", ")}.`;
}

function counterpartyLabelForKind(kind: DraftForm["kind"]): string {
  switch (kind) {
    case "income":
    case "fund-addition":
      return "Source";
    case "adjustment":
      return "Reason";
    case "expense":
      return "Merchant";
    case "refund":
      return "Merchant or source";
    default:
      return "Merchant or source";
  }
}

function readStoredDrafts(): TransactionDraft[] {
  try {
    const stored = window.localStorage.getItem(draftsStorageKey);
    if (!stored) {
      return [];
    }

    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as TransactionDraft[]) : [];
  } catch {
    return [];
  }
}

function PrimaryNav({ route, navigate }: Readonly<{ route: AppRoute; navigate: (item: NavItem) => void }>) {
  return (
    <nav className="nav-list">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            className={`nav-item ${route === item.route ? "active" : ""}`}
            key={item.route}
            type="button"
            aria-current={route === item.route ? "page" : undefined}
            onClick={() => navigate(item)}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

type StatusItem = { label: string; detail: string; tone: string; icon: LucideIcon };

function syncStatusItem({
  enabled,
  blocked,
  online,
  pendingCount,
  conflictCount,
  errorCount,
  firstError,
}: Readonly<{
  enabled: boolean;
  blocked: boolean;
  online: boolean;
  pendingCount: number;
  conflictCount: number;
  errorCount: number;
  firstError?: string;
}>): StatusItem {
  if (blocked) {
    return { label: "Local data review required", detail: "This signed-in workspace will not claim data from another local user automatically.", icon: CloudOff, tone: "danger" };
  }
  if (!enabled) {
    return { label: online ? "Sync not enabled" : "Offline", detail: online ? "This preview keeps changes on this device." : "Drafts and records stay visible on this device while offline.", icon: online ? Wifi : WifiOff, tone: "neutral" };
  }
  if (conflictCount > 0) {
    return { label: `${conflictCount} sync conflict${conflictCount === 1 ? "" : "s"} need review`, detail: "Conflicting local and cloud versions are held for review before either one is replaced.", icon: CloudOff, tone: "danger" };
  }
  if (errorCount > 0) {
    return { label: `${errorCount} cloud sync error${errorCount === 1 ? "" : "s"}`, detail: firstError ? `The latest sync attempt failed: ${firstError}` : "A cloud write failed and will be retried when possible.", icon: CloudOff, tone: "danger" };
  }
  if (pendingCount > 0) {
    return { label: `${pendingCount} cloud sync pending`, detail: "Local changes are queued for the configured Supabase workspace.", icon: CloudOff, tone: "warn" };
  }
  return { label: "Cloud sync ready", detail: "Cloud writes use the authenticated workspace.", icon: Wifi, tone: "neutral" };
}

function buildStatusItems({
  authState,
  userId,
  cloudDataOwnerMatches,
  cloudSyncQueue,
  isOnline,
  draftCount,
  persistenceWarning,
  uploadCount,
  recordCount,
}: Readonly<{
  authState: AuthState;
  userId: string;
  cloudDataOwnerMatches: boolean;
  cloudSyncQueue: CloudSyncQueueItem[];
  isOnline: boolean;
  draftCount: number;
  persistenceWarning: boolean;
  uploadCount: number;
  recordCount: number;
}>): StatusItem[] {
  const cloudSyncEnabled = isSupabaseConfigured && authState === "signed-in" && userId !== "local-user";
  const errorItems = cloudSyncQueue.filter((item) => item.state === "retryable-error" || item.state === "failed");
  const items: StatusItem[] = [
    syncStatusItem({
      enabled: cloudSyncEnabled,
      blocked: cloudSyncEnabled && !cloudDataOwnerMatches,
      online: isOnline,
      pendingCount: cloudSyncQueue.filter((item) => item.state !== "synced").length,
      conflictCount: cloudSyncQueue.filter((item) => item.state === "conflict").length,
      errorCount: errorItems.length,
      firstError: errorItems.find((item) => item.lastError)?.lastError,
    }),
    {
      label: draftCountLabel(draftCount),
      detail: draftCount > 0 ? "Continue incomplete drafts in Capture, or confirm a complete draft here." : "Nothing is waiting for review.",
      icon: draftCount > 0 ? AlertCircle : CheckCircle2,
      tone: draftCount > 0 ? "warn" : "good",
    },
  ];

  if (persistenceWarning) items.push({ label: "Local storage unavailable", detail: "Changes may be lost if this page is closed. Export or keep this page open until storage is restored.", icon: AlertCircle, tone: "warn" });
  if (draftCount > 0) items.push({ label: "Local-only data", detail: "These drafts stay on this device until a future sync workflow is enabled.", icon: CloudOff, tone: "warn" });
  if (uploadCount > 0) items.push({ label: "Media metadata only", detail: `${uploadCount} image${uploadCount === 1 ? "" : "s"} queued locally; image bytes are not backed up in this local-only preview.`, icon: CloudOff, tone: "warn" });
  if (recordCount > 0) items.push({ label: `${recordCount} local record${recordCount === 1 ? "" : "s"}`, detail: "Official manual records are stored locally until cloud sync is enabled.", icon: CloudOff, tone: "warn" });
  return items;
}

function StatusStrip({ items }: Readonly<{ items: StatusItem[] }>) {
  return (
    <section className="status-strip" aria-label="Application status">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div className={`status-item ${item.tone}`} key={item.label} title={item.detail} aria-label={`${item.label}. ${item.detail}`}>
            <Icon size={16} aria-hidden="true" />
            <strong>{item.label}</strong>
          </div>
        );
      })}
    </section>
  );
}

function Brand({ caption, large = false }: Readonly<{ caption: string; large?: boolean }>) {
  return (
    <div className={`brand ${large ? "large" : ""}`}>
      <div className="brand-mark">
        <ReceiptText size={large ? 22 : 20} aria-hidden="true" />
      </div>
      <div>
        <p className="brand-name">MealLedger</p>
        <p className="brand-caption">{caption}</p>
      </div>
    </div>
  );
}

function Sidebar({ route, navigate }: Readonly<{ route: AppRoute; navigate: (item: NavItem) => void }>) {
  return (
    <aside className="sidebar" aria-label="MealLedger navigation">
      <Brand caption="Personal ledger with optional meal notes" />
      <PrimaryNav route={route} navigate={navigate} />
      <div className="storage-note">
        <ShieldCheck size={18} aria-hidden="true" />
        <span>Ledger exports stay separate from receipt and meal photos.</span>
      </div>
    </aside>
  );
}

function WorkspaceHeader({ route, statusItems }: Readonly<{ route: AppRoute; statusItems: StatusItem[] }>) {
  return (
    <section className="page-header" aria-labelledby="page-title">
      <header className="topbar">
        <div className="topbar-title">
          <p className="eyebrow">Personal finance workspace</p>
          <h1 id="page-title">{routeTitle(route)}</h1>
        </div>
      </header>
      <StatusStrip items={statusItems} />
    </section>
  );
}

function routeFromLocation(): AppLocation {
  const segments = window.location.pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));

  for (const definition of routeDefinitions) {
    if (definition.segments.length !== segments.length) {
      continue;
    }

    const params: Record<string, string> = {};
    const matches = definition.segments.every((segment, index) => {
      const value = segments[index];
      if (segment.startsWith(":")) {
        params[segment.slice(1)] = value;
        return true;
      }
      return segment === value;
    });

    if (matches) {
      return { route: definition.route, params };
    }
  }

  return { route: "not-found", params: {} };
}

export function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}

function AuthenticatedApp() {
  const [location, setLocation] = useState<AppLocation>(routeFromLocation);
  const { state: authState, userId, message: authMessage, configurationError, signIn, signOut } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [accounts, setAccounts] = useState<LocalAccount[]>(readStoredAccounts);
  const [onboardingCompleted, setOnboardingCompleted] = useState(readOnboardingCompleted);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [meals, setMeals] = useState<MealEntry[]>(readStoredMeals);
  const [scans, setScans] = useState<TemporaryScan[]>(() => expireTemporaryScans(readStoredScans()));
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>(readStoredUploadQueue);
  const [persistenceWarning, setPersistenceWarning] = useState(false);
  const [drafts, setDrafts] = useState<TransactionDraft[]>(readStoredDrafts);
  const [draftToEdit, setDraftToEdit] = useState<TransactionDraft | null>(null);
  const [records, setRecords] = useState<LocalLedgerRecord[]>(readStoredRecords);
  const [auditEvents, setAuditEvents] = useState<LocalAuditEvent[]>(readStoredAuditEvents);
  const [cloudSyncQueue, setCloudSyncQueue] = useState<CloudSyncQueueItem[]>(readStoredCloudSyncQueue);
  const [localDataOwner, setLocalDataOwner] = useState(readLocalDataOwner);
  const cloudSyncInFlight = useRef(false);
  const route = location.route;
  const draftCount = drafts.length;
  const recordCount = records.length;

  useEffect(() => {
    try {
      window.localStorage.setItem(draftsStorageKey, JSON.stringify(drafts));
    } catch {
      setPersistenceWarning(true);
    }
  }, [drafts]);

  useEffect(() => {
    try {
      window.localStorage.setItem(accountsStorageKey, JSON.stringify(accounts));
      window.localStorage.setItem(recordsStorageKey, JSON.stringify(records));
      window.localStorage.setItem(auditEventsStorageKey, JSON.stringify(auditEvents));
      window.localStorage.setItem(onboardingStorageKey, String(onboardingCompleted));
      window.localStorage.setItem(mealsStorageKey, JSON.stringify(meals));
      window.localStorage.setItem(scansStorageKey, JSON.stringify(scans));
      window.localStorage.setItem(uploadQueueStorageKey, JSON.stringify(uploadQueue));
      window.localStorage.setItem(cloudSyncQueueStorageKey, JSON.stringify(cloudSyncQueue));
    } catch {
      setPersistenceWarning(true);
    }
  }, [accounts, auditEvents, cloudSyncQueue, meals, onboardingCompleted, records, scans, uploadQueue]);

  useEffect(() => {
    if (authState !== "signed-in" || !userId) return;
    const hasLocalData = accounts.length > 0 || records.length > 0 || drafts.length > 0 || meals.length > 0 || scans.length > 0 || uploadQueue.length > 0;
    if (!localDataOwner && (userId === "local-user" || !hasLocalData)) {
      try {
        window.localStorage.setItem(localDataOwnerStorageKey, userId);
      } catch {
        setPersistenceWarning(true);
      }
      setLocalDataOwner(userId);
    }
  }, [accounts.length, authState, drafts.length, localDataOwner, meals.length, records.length, scans.length, uploadQueue.length, userId]);

  const cloudDataOwnerMatches = localDataOwner === userId;

  useEffect(() => {
    if (!isSupabaseConfigured || authState !== "signed-in" || !userId || userId === "local-user" || !cloudDataOwnerMatches) return;
    const now = new Date().toISOString();
    setCloudSyncQueue((current) => enqueueLocalChanges(current, records, drafts, meals, uploadQueue, scans, now));
  }, [authState, cloudDataOwnerMatches, drafts, meals, records, scans, uploadQueue, userId]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || authState !== "signed-in" || !userId || userId === "local-user" || !cloudDataOwnerMatches || !isOnline || cloudSyncInFlight.current) {
      return;
    }

    if (cloudSyncQueue.every((item) => item.state === "synced")) return;

    cloudSyncInFlight.current = true;
    const rawClient = supabase as unknown as RawSupabaseClient;
    const client = createSupabasePersistenceClient(rawClient);
    const referenceClient = createSupabaseReferenceBootstrapClient(rawClient);
    const now = new Date().toISOString();

    const categories = [...new Set([...readStoredCategories(), ...records.map((record) => record.category)].map((value) => value.trim()).filter(Boolean))];
    const tags = [...new Set(records.flatMap((record) => record.tags ?? []).map((value) => value.trim()).filter(Boolean))];
    const events = [...new Set(records.map((record) => record.event ?? "").map((value) => value.trim()).filter(Boolean))];
    syncLocalChanges({
      client,
      referenceClient,
      userId,
      accounts,
      categories,
      tags,
      events,
      auditEvents,
      records,
      drafts,
      meals,
      media: uploadQueue,
      scans,
      queue: cloudSyncQueue,
      now,
    }).then((result) => {
      setRecords(result.records);
      setMeals(result.meals);
      setUploadQueue(result.media);
      setScans(result.scans);
      setCloudSyncQueue(result.queue);
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Cloud synchronization failed.";
      setCloudSyncQueue((current) => current.map((item) => {
        if (item.state !== "pending" && item.state !== "retryable-error") return item;
        return { ...item, state: "retryable-error", lastError: message, nextAttemptAt: new Date(Date.now() + 1_000).toISOString(), updatedAt: new Date().toISOString() };
      }));
    }).finally(() => {
      cloudSyncInFlight.current = false;
    });
  }, [accounts, authState, cloudDataOwnerMatches, cloudSyncQueue, drafts, isOnline, meals, records, scans, uploadQueue, userId]);

  useEffect(() => {
    const handlePopState = () => setLocation(routeFromLocation());
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ left: 0, top: 0 });
  }, [location]);

  const queueRecordBundle = (bundleRecords: LocalLedgerRecord[]) => {
    const now = new Date().toISOString();
    setCloudSyncQueue((current) => bundleRecords.reduce(
      (next, record) => enqueueRecordSync(next, record, now),
      current,
    ));
  };

  const statusItems = useMemo(() => buildStatusItems({
    authState,
    userId,
    cloudDataOwnerMatches,
    cloudSyncQueue,
    isOnline,
    draftCount,
    persistenceWarning,
    uploadCount: uploadQueue.length,
    recordCount,
  }), [authState, cloudDataOwnerMatches, cloudSyncQueue, draftCount, isOnline, persistenceWarning, recordCount, uploadQueue.length, userId]);

  const navigate = (item: NavItem) => {
    window.history.pushState(null, "", item.path);
    setLocation({ route: item.route, params: {} });
  };

  if (authState === "loading" && !authMessage) {
    return <AuthLoadingShell />;
  }

  if (authState !== "signed-in") {
    return <SignedOutShell authState={authState} authMessage={authMessage} configurationError={configurationError} onSignIn={signIn} />;
  }

  if (onboardingOpen || (!onboardingCompleted && accounts.length === 0)) {
    return (
      <OnboardingPage
        onComplete={() => { setOnboardingCompleted(true); setOnboardingOpen(false); }}
        onAddAccount={(account) => setAccounts((current) => [...current, account])}
        onApplyDefaultTaxonomy={() => {
          const next = applyDefaultTaxonomy({
            categories: readStoredCategories(),
            tags: readStoredLabels(tagsStorageKey),
            aliases: readStoredAliases(),
          });

          try {
            window.localStorage.setItem(categoriesStorageKey, JSON.stringify(next.categories));
            window.localStorage.setItem(tagsStorageKey, JSON.stringify(next.tags));
            window.localStorage.setItem(aliasesStorageKey, JSON.stringify(next.aliases));
          } catch {
            // Taxonomy seed is best effort in local development.
          }
        }}
        onSaveInitialFunding={(account, draft) => {
          const now = new Date().toISOString();
          const bundle = createOfficialRecordBundle(draft, [account, ...accounts], {
            userId: "local-user",
            recordId: `record-${draft.id}`,
            idempotencyKey: `onboarding:${draft.id}`,
            createdAt: now,
          });

          if (!bundle) {
            return false;
          }

          setRecords((current) => appendIdempotentRecords(current, bundle));
          setAuditEvents((current) => [...current, ...bundle.auditEvents]);
          queueRecordBundle(bundle.records);
          return true;
        }}
      />
    );
  }

  return (
    <main className="app-shell">
      <Sidebar route={route} navigate={navigate} />

      <section className="workspace">
        <WorkspaceHeader route={route} statusItems={statusItems} />
        {renderRoute({
          route,
          drafts,
          setDrafts,
          draftToEdit,
          setDraftToEdit,
          records,
          setRecords,
          setAuditEvents,
          queueRecordBundle,
          cloudSyncIssues: cloudSyncQueue.filter((item) => item.state === "retryable-error" || item.state === "failed" || item.state === "conflict"),
          onRetryCloudSyncItem: (id) => setCloudSyncQueue((current) => retryCloudSyncItem(current, id, new Date().toISOString())),
          accounts,
          setAccounts,
          navigate,
          onReopenOnboarding: () => setOnboardingOpen(true),
          onSignOut: signOut,
          onSaveMeal: (meal) => setMeals((current) => [...current, meal]),
          scans,
          onSaveScans: (nextScans) => setScans((current) => [...current, ...nextScans]),
          onUpdateScan: (scan) => setScans((current) => current.map((item) => item.id === scan.id ? scan : item)),
          uploadQueue,
          onQueueUploads: (items) => setUploadQueue((current) => [...current, ...items]),
        })}
      </section>
    </main>
  );
}

function OnboardingPage({ onComplete, onAddAccount, onApplyDefaultTaxonomy, onSaveInitialFunding }: Readonly<{
  onComplete: () => void;
  onAddAccount: (account: LocalAccount) => void;
  onApplyDefaultTaxonomy: () => void;
  onSaveInitialFunding: (account: LocalAccount, draft: TransactionDraft) => boolean;
}>) {
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState("cash");
  const [currency, setCurrency] = useState("TWD");
  const [allowNegativeBalance, setAllowNegativeBalance] = useState(true);
  const [balanceMode, setBalanceMode] = useState<"zero" | "current">("zero");
  const [balance, setBalance] = useState("");
  const [balanceDate, setBalanceDate] = useState(localDate());
  const [error, setError] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const account = createLocalAccount(accountName, currency, crypto.randomUUID(), accountType, allowNegativeBalance);

    if (!account) {
      setError("Enter an account name and currency.");
      return;
    }

    if (balanceMode === "current") {
      const draft = createInitialFundingDraft({ account: account.name, amount: balance, currency: account.currency, date: balanceDate }, `fund-${account.id}`);
      if (!draft || !onSaveInitialFunding(account, draft)) {
        setError("Enter a positive current balance and a valid date.");
        return;
      }
    }

    onAddAccount(account);
    onApplyDefaultTaxonomy();
    onComplete();
  };

  return (
    <main className="signed-out-shell">
      <section className="signed-out-panel onboarding-panel">
        <Brand caption="Personal finance records" large />
        <div>
          <p className="eyebrow">First setup</p>
          <h1>Set up your first account</h1>
          <p className="lede">Your current balance is recorded as initial funds, not income.</p>
        </div>
        <form className="onboarding-form" noValidate onSubmit={submit}>
          <OnboardingFields
            accountName={accountName}
            accountType={accountType}
            currency={currency}
            allowNegativeBalance={allowNegativeBalance}
            balanceMode={balanceMode}
            balance={balance}
            balanceDate={balanceDate}
            onAccountNameChange={setAccountName}
            onAccountTypeChange={setAccountType}
            onCurrencyChange={setCurrency}
            onAllowNegativeBalanceChange={setAllowNegativeBalance}
            onBalanceModeChange={setBalanceMode}
            onBalanceChange={setBalance}
            onBalanceDateChange={setBalanceDate}
          />
          <OnboardingActions onComplete={onComplete} />
          {error ? <p className="quick-account-error" role="alert">{error}</p> : null}
        </form>
      </section>
    </main>
  );
}

function OnboardingFields({
  accountName,
  accountType,
  currency,
  allowNegativeBalance,
  balanceMode,
  balance,
  balanceDate,
  onAccountNameChange,
  onAccountTypeChange,
  onCurrencyChange,
  onAllowNegativeBalanceChange,
  onBalanceModeChange,
  onBalanceChange,
  onBalanceDateChange,
}: Readonly<{
  accountName: string;
  accountType: string;
  currency: string;
  allowNegativeBalance: boolean;
  balanceMode: "zero" | "current";
  balance: string;
  balanceDate: string;
  onAccountNameChange: (value: string) => void;
  onAccountTypeChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  onAllowNegativeBalanceChange: (value: boolean) => void;
  onBalanceModeChange: (value: "zero" | "current") => void;
  onBalanceChange: (value: string) => void;
  onBalanceDateChange: (value: string) => void;
}>) {
  return (
    <>
      <label>
        <span>Account name</span>
        <input required value={accountName} onChange={(event) => onAccountNameChange(event.target.value)} placeholder="Daily wallet" />
      </label>
      <label>
        <span>Account type</span>
        <select value={accountType} onChange={(event) => onAccountTypeChange(event.target.value)}>
          <option value="cash">Cash</option>
          <option value="bank">Bank account</option>
          <option value="card">Credit card</option>
          <option value="wallet">Stored-value wallet</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label>
        <span>Currency</span>
        <select value={currency} onChange={(event) => onCurrencyChange(event.target.value)}>
          <option value="TWD">TWD</option>
          <option value="JPY">JPY</option>
          <option value="USD">USD</option>
        </select>
      </label>
      <label className="checkbox-row">
        <input type="checkbox" checked={allowNegativeBalance} onChange={(event) => onAllowNegativeBalanceChange(event.target.checked)} />
        <span>Allow negative balance</span>
      </label>
      <fieldset>
        <legend>Starting balance</legend>
        <label className="radio-row"><input type="radio" checked={balanceMode === "zero"} onChange={() => onBalanceModeChange("zero")} /> <span>Start from zero</span></label>
        <label className="radio-row"><input type="radio" checked={balanceMode === "current"} onChange={() => onBalanceModeChange("current")} /> <span>Enter current balance</span></label>
      </fieldset>
      {balanceMode === "current" ? <div className="onboarding-balance-fields">
        <AmountField id="onboarding-current-balance" label="Current balance" required value={balance} onChange={onBalanceChange} placeholder="0" />
        <label>
          <span>As of date</span>
          <input required type="date" value={balanceDate} onChange={(event) => onBalanceDateChange(event.target.value)} />
        </label>
      </div> : null}
    </>
  );
}

function OnboardingActions({ onComplete }: Readonly<{ onComplete: () => void }>) {
  return (
    <div className="onboarding-actions">
      <button className="primary-action" type="submit">Create account</button>
      <button className="quiet-action" type="button" onClick={onComplete}>Browse workspace</button>
    </div>
  );
}

function AuthLoadingShell() {
  return (
    <main className="signed-out-shell">
      <section className="signed-out-panel" aria-live="polite">
        <Brand caption="Personal finance records" large />
        <p className="eyebrow">MealLedger</p>
        <h1>Checking your workspace session...</h1>
      </section>
    </main>
  );
}

function SignedOutShell({ authState, authMessage, configurationError, onSignIn }: Readonly<{ authState: AuthState; authMessage: string; configurationError: boolean; onSignIn: (email?: string) => Promise<void> }>) {
  const [email, setEmail] = useState("");
  let authControl: React.ReactNode = null;

  if (!configurationError && isLocalDevelopmentMode) {
    authControl = (
      <button className="primary-action" type="button" onClick={() => { onSignIn().catch(() => undefined); }}>
        <LogIn size={18} aria-hidden="true" />
        Open workspace
      </button>
    );
  } else if (!configurationError) {
    authControl = (
      <form className="auth-form" onSubmit={(event) => { event.preventDefault(); onSignIn(email).catch(() => undefined); }}>
        <label htmlFor="auth-email">Email</label>
        <input id="auth-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
        <button className="primary-action" type="submit" disabled={authState === "loading"}>
          <LogIn size={18} aria-hidden="true" />
          {authState === "loading" ? "Sending link..." : "Send magic link"}
        </button>
      </form>
    );
  }

  return (
    <main className="signed-out-shell">
      <section className="signed-out-panel">
        <Brand caption="Personal finance records" large />
        <div>
          <p className="eyebrow">MealLedger</p>
          <h1>Track spending first, attach meals when useful.</h1>
          <p className="lede">
            Start with ledger records, keep scans and photos separate, and review every draft before
            a later ledger workflow writes it.
          </p>
        </div>
        {authControl}
        {authMessage ? <p className="auth-message" aria-live={authState === "auth-error" ? "assertive" : "polite"}>{authMessage}</p> : null}
      </section>
    </main>
  );
}

type RouteRenderContext = {
  route: AppRoute;
  drafts: TransactionDraft[];
  setDrafts: Dispatch<SetStateAction<TransactionDraft[]>>;
  draftToEdit: TransactionDraft | null;
  setDraftToEdit: Dispatch<SetStateAction<TransactionDraft | null>>;
  records: LocalLedgerRecord[];
  setRecords: Dispatch<SetStateAction<LocalLedgerRecord[]>>;
  setAuditEvents: Dispatch<SetStateAction<LocalAuditEvent[]>>;
  queueRecordBundle: (records: LocalLedgerRecord[]) => void;
  cloudSyncIssues: CloudSyncQueueItem[];
  onRetryCloudSyncItem: (id: string) => void;
  accounts: LocalAccount[];
  setAccounts: Dispatch<SetStateAction<LocalAccount[]>>;
  navigate: (item: NavItem) => void;
  onReopenOnboarding: () => void;
  onSignOut: () => Promise<void>;
  onSaveMeal: (meal: MealEntry) => void;
  scans: TemporaryScan[];
  onSaveScans: (scans: TemporaryScan[]) => void;
  onUpdateScan: (scan: TemporaryScan) => void;
  uploadQueue: UploadQueueItem[];
  onQueueUploads: (items: UploadQueueItem[]) => void;
};

function renderRoute({
  route,
  drafts,
  setDrafts,
  draftToEdit,
  setDraftToEdit,
  records,
  setRecords,
  setAuditEvents,
  queueRecordBundle,
  cloudSyncIssues,
  onRetryCloudSyncItem,
  accounts,
  setAccounts,
  navigate,
  onReopenOnboarding,
  onSignOut,
  onSaveMeal,
  scans,
  onSaveScans,
  onUpdateScan,
  uploadQueue,
  onQueueUploads,
}: Readonly<RouteRenderContext>) {
  const draftCount = drafts.length;
  const recordCount = records.length;

  switch (route) {
    case "overview":
      return <OverviewPage draftCount={draftCount} recordCount={recordCount} accountBalances={calculateAccountBalances(accounts, records)} accountReports={calculateAccountReports(accounts, records)} syncIssues={cloudSyncIssues} onRetrySyncItem={onRetryCloudSyncItem} navigate={navigate} />;
    case "ledger":
      return (
        <LedgerPage
          records={records}
          drafts={drafts}
          navigate={navigate}
          onDiscardDraft={(id) => setDrafts((current) => current.filter((draft) => draft.id !== id))}
          onEditDraft={(draft) => {
            setDraftToEdit(draft);
            navigate(navItemFor("capture"));
          }}
          onConfirmDraft={(draft) => {
            const now = new Date().toISOString();
            const bundle = createOfficialRecordBundle(draft, accounts, {
              userId: "local-user",
              recordId: `record-${draft.id}`,
              idempotencyKey: `draft:${draft.id}`,
              createdAt: now,
            });
            if (!bundle) {
              return false;
            }

            setRecords((current) => appendIdempotentRecords(current, bundle));
            setAuditEvents((current) => [...current, ...bundle.auditEvents]);
            setDrafts((current) => current.filter((item) => item.id !== draft.id));
            queueRecordBundle(bundle.records);
            return true;
          }}
          onUpdateRecord={(id, patch) => {
            const record = records.find((item) => item.id === id);
            if (!record || record.recordState === "voided") {
              return;
            }

            const result = updateOfficialRecord(record, patch, new Date().toISOString());
            setRecords((current) => current.map((item) => item.id === id ? result.record : item));
            setAuditEvents((current) => [...current, result.auditEvent]);
          }}
          onConvertUnresolved={(id, fields) => {
            const record = records.find((item) => item.id === id);
            if (!record) {
              return false;
            }

            const result = convertUnresolvedExpense(record, fields, accounts, new Date().toISOString());
            if (!result) {
              return false;
            }

            setRecords((current) => current.map((item) => item.id === id ? result.record : item));
            setAuditEvents((current) => [...current, result.auditEvent]);
            return true;
          }}
          onVoidRecord={(id) => {
            const record = records.find((item) => item.id === id);
            if (!record || record.recordState === "voided") {
              return;
            }

            const result = voidOfficialRecord(record, new Date().toISOString());
            setRecords((current) => current.map((item) => item.id === id ? result.record : item));
            setAuditEvents((current) => [...current, result.auditEvent]);
          }}
        />
      );
    case "capture":
      return (
        <CapturePage
          records={records}
          accounts={accounts}
          navigate={navigate}
          draftToEdit={draftToEdit}
          onDiscardDraft={(id) => setDrafts((current) => current.filter((draft) => draft.id !== id))}
          onFinishDraftEdit={() => setDraftToEdit(null)}
          onAddAccount={(account) => setAccounts((current) => [...current, account])}
          onSaveInitialFunding={(account, draft) => {
            const now = new Date().toISOString();
            const bundle = createOfficialRecordBundle(draft, [account, ...accounts], {
              userId: "local-user",
              recordId: `record-${draft.id}`,
              idempotencyKey: `capture:${draft.id}`,
              createdAt: now,
            });

            if (!bundle) {
              return false;
            }

            setRecords((current) => appendIdempotentRecords(current, bundle));
            setAuditEvents((current) => [...current, ...bundle.auditEvents]);
            queueRecordBundle(bundle.records);
            return true;
          }}
          onSaveRecord={(draft) => {
            const now = new Date().toISOString();
            const bundle = createOfficialRecordBundle(draft, accounts, {
              userId: "local-user",
              recordId: `record-${draft.id}`,
              idempotencyKey: `manual:${draft.id}`,
              createdAt: now,
            });

            if (!bundle) {
              return false;
            }

            setRecords((current) => appendIdempotentRecords(current, bundle));
            setAuditEvents((current) => [...current, ...bundle.auditEvents]);
            queueRecordBundle(bundle.records);
            return true;
          }}
          onSaveDraft={(draft) => setDrafts((current) => [...current, draft])}
          onSaveMeal={onSaveMeal}
          scans={scans}
          onSaveScans={onSaveScans}
          onUpdateScan={onUpdateScan}
          uploadQueue={uploadQueue}
          onQueueUploads={onQueueUploads}
        />
      );
    case "settings":
      return (
        <SettingsPage
          accounts={accounts}
          records={records}
          onAddAccount={(account) => setAccounts((current) => [...current, account])}
          onSaveInitialFunding={(account, draft) => {
            const now = new Date().toISOString();
            const bundle = createOfficialRecordBundle(draft, [account, ...accounts], {
              userId: "local-user",
              recordId: `record-${draft.id}`,
              idempotencyKey: `settings:${draft.id}`,
              createdAt: now,
            });

            if (!bundle) {
              return false;
            }

            setRecords((current) => appendIdempotentRecords(current, bundle));
            setAuditEvents((current) => [...current, ...bundle.auditEvents]);
            queueRecordBundle(bundle.records);
            return true;
          }}
          onImportRecord={(row, importId) => {
            const draft = toImportedTransactionDraft(row, importId);
            if (!draft) {
              return false;
            }

            const now = new Date().toISOString();
            const bundle = createOfficialRecordBundle(draft, accounts, {
              userId: "local-user",
              recordId: `record-${importId}`,
              idempotencyKey: `import:${importId}`,
              createdAt: now,
              feeRecordId: `record-${importId}-fee`,
            });
            if (!bundle) {
              return false;
            }

            setRecords((current) => appendIdempotentRecords(current, bundle));
            setAuditEvents((current) => [...current, ...bundle.auditEvents]);
            queueRecordBundle(bundle.records);
            return true;
          }}
          onMergeImportDraft={(row, importId) => {
            const draft = toImportedTransactionDraft(row, importId);
            if (!draft) {
              return false;
            }

            setDrafts((current) => current.some((item) => item.id === draft.id) ? current : [...current, draft]);
            return true;
          }}
          onReopenOnboarding={onReopenOnboarding}
          onSignOut={onSignOut}
        />
      );
    default:
      return <NotFoundPage navigate={navigate} />;
  }
}

function OverviewPage({ draftCount, recordCount, accountBalances, accountReports, syncIssues, onRetrySyncItem, navigate }: Readonly<{
  draftCount: number;
  recordCount: number;
  accountBalances: ReturnType<typeof calculateAccountBalances>;
  accountReports: AccountReport[];
  syncIssues: CloudSyncQueueItem[];
  onRetrySyncItem: (id: string) => void;
  navigate: (item: NavItem) => void;
}>) {
  const accountDetail = accountBalances.length === 0
    ? "Add accounts before recording transactions."
    : accountBalances.slice(0, 3).map((account) => `${account.name}: ${formatAccountBalance(account.balance, account.currency)}`).join(" · ");

  return (
    <div className="route-stack">
      <section className="summary-grid">
        <EmptyMetric label="Account summary" value={metricValue(accountBalances.length, "account", "No balances yet")} detail={accountDetail} />
        <EmptyMetric label="Ledger records" value={metricValue(recordCount, "saved", "No records")} detail={metricDetail(recordCount, "Official local records are ready in Ledger.", "Your confirmed transactions will appear here.")} />
        <EmptyMetric
          label="Draft reviews"
          value={metricValue(draftCount, "waiting", "None")}
          detail={metricDetail(draftCount, "Drafts are ready to review.", "Scans and imports will wait for review.")}
        />
      </section>
      {syncIssues.length > 0 ? (
        <Panel title="Sync attention" eyebrow="Action required">
          <div className="sync-issues" aria-label="Cloud sync issues">
            {syncIssues.map((item) => {
              const targetLabel = syncTargetLabel(item.target);

              return (
                <article className="sync-issue" key={item.id}>
                  <div>
                    <strong>{targetLabel}</strong>
                    <span>{item.state === "conflict" ? "Conflict requires review; local data was not overwritten." : item.lastError || "Cloud write is waiting to be retried."}</span>
                  </div>
                  {item.state === "conflict" ? (
                    <span className="record-state-label">Review required</span>
                  ) : (
                    <button className="text-action" type="button" onClick={() => onRetrySyncItem(item.id)}>Retry sync</button>
                  )}
                </article>
              );
            })}
          </div>
        </Panel>
      ) : null}
      <Panel title="Account report" eyebrow="Accounting view">
        {accountReports.length === 0 ? (
          <p className="panel-copy">Add an account to see income, spending, refunds, transfers, and adjustments separately.</p>
        ) : (
          <div className="report-list" aria-label="Account report">
            {accountReports.map((report) => (
              <div className="report-row" key={report.id}>
                <div>
                  <strong>{report.name}</strong>
                  <span>{report.currency} · {countLabel(report.recordCount, "record")}</span>
                </div>
                <dl>
                  <div><dt>Balance</dt><dd>{formatAccountBalance(report.closingBalance, report.currency)}</dd></div>
                  <div><dt>Net spending</dt><dd>{formatAccountBalance(report.netSpendingTotal, report.currency)}</dd></div>
                  <div><dt>Cash flow</dt><dd>{formatAccountBalance(report.cashFlowTotal, report.currency)}</dd></div>
                </dl>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <section className="content-grid">
        <Panel title="Start with a new record" eyebrow="First step">
          <p className="panel-copy">
            Manual records save directly to the local ledger after required fields pass validation.
            Scans and imports remain drafts until you confirm them.
          </p>
          <button className="secondary-action align-start" type="button" onClick={() => navigate(navItemFor("capture"))}>
            Start a record
          </button>
        </Panel>
        <Panel title="Review before it counts" eyebrow="Data safety">
          <p className="panel-copy">
            Imported rows and scanned receipts stay in Review until you continue incomplete fields or
            confirm the completed draft. Meal photos stay separate from ledger records.
          </p>
        </Panel>
      </section>
    </div>
  );
}

function ConfirmActionButton({ label, message, onConfirm }: Readonly<{
  label: string;
  message: string;
  onConfirm: () => void;
}>) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return <button className="text-action danger-action" type="button" onClick={() => setConfirming(true)}>{label}</button>;
  }

  return (
    <div className="confirm-action" aria-label={message}>
      <span>{message}</span>
      <button className="text-action danger-action" type="button" onClick={() => { onConfirm(); setConfirming(false); }}>Confirm</button>
      <button className="text-action" type="button" onClick={() => setConfirming(false)}>Cancel</button>
    </div>
  );
}

type LedgerRecordCardProps = {
  record: LocalLedgerRecord;
  isEditing: boolean;
  isEditingUnresolved: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (patch: Partial<EditableRecordFields>) => void;
  onCompleteDetails: () => void;
  onCancelDetails: () => void;
  onConvertDetails: (fields: UnresolvedExpenseConversion) => boolean;
  onUpdate: (patch: Partial<EditableRecordFields>) => void;
  onVoid: () => void;
};

function LedgerRecordCard({
  record,
  isEditing,
  isEditingUnresolved,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onCompleteDetails,
  onCancelDetails,
  onConvertDetails,
  onUpdate,
  onVoid,
}: Readonly<LedgerRecordCardProps>) {
  if (isEditingUnresolved && record.recordState !== "voided") {
    return <UnresolvedExpenseEditor record={record} onCancel={onCancelDetails} onConvert={onConvertDetails} />;
  }

  if (isEditing && record.recordState !== "voided") {
    return <RecordEditor record={record} onCancel={onCancelEdit} onSave={onSaveEdit} />;
  }

  const isVoided = record.recordState === "voided";
  const isRecurring = record.recurrenceStatus === "active" || record.recurrenceStatus === "paused";
  return (
    <article className={`draft-card ${isVoided ? "voided-record" : ""}`}>
      <div>
        <strong>{recordDisplayName(record)}</strong>
        <span>{record.localDate} · {record.accountName} · {record.category || record.reason || "No category"}</span>
      </div>
      <div className="draft-amount">
        <strong>{record.currency} {record.amount}</strong>
        <span>{record.kind} · {isVoided ? "voided" : record.status}</span>
      </div>
      {isVoided ? <span className="record-state-label">Voided</span> : (
        <div className="record-actions">
          {record.kind === "unresolved-expense" ? <button className="text-action" type="button" onClick={onCompleteDetails}>Complete details</button> : null}
          {isRecurring ? (
            <button className="text-action" type="button" onClick={() => onUpdate({ recurrenceStatus: record.recurrenceStatus === "active" ? "paused" : "active" })}>
              {record.recurrenceStatus === "active" ? "Pause recurring" : "Resume recurring"}
            </button>
          ) : null}
          {isRecurring ? <ConfirmActionButton label="Cancel recurring" message="Cancel future recurrence?" onConfirm={() => onUpdate({ recurrenceStatus: "cancelled" })} /> : null}
          <button className="text-action" type="button" onClick={onEdit}>Edit</button>
          <ConfirmActionButton label="Void" message="Void this record? It remains in history but leaves active totals." onConfirm={onVoid} />
        </div>
      )}
    </article>
  );
}

function LedgerPage({
  records,
  drafts,
  navigate,
  onDiscardDraft,
  onEditDraft,
  onConfirmDraft,
  onUpdateRecord,
  onConvertUnresolved,
  onVoidRecord,
}: Readonly<{
  records: LocalLedgerRecord[];
  drafts: TransactionDraft[];
  navigate: (item: NavItem) => void;
  onDiscardDraft: (id: string) => void;
  onEditDraft: (draft: TransactionDraft) => void;
  onConfirmDraft: (draft: TransactionDraft) => boolean;
  onUpdateRecord: (id: string, patch: Partial<EditableRecordFields>) => void;
  onConvertUnresolved: (id: string, fields: UnresolvedExpenseConversion) => boolean;
  onVoidRecord: (id: string) => void;
}>) {
  const draftCount = drafts.length;
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingUnresolvedId, setEditingUnresolvedId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const ledgerColumns = [
    "Record ID",
    "Date",
    "Account",
    "Type",
    "Category",
    "Merchant / Payee",
    "Transfer account",
    "Amount",
    "Currency",
    "Notes",
    "Tags",
    "Attachment",
    "Entry source",
    "Balance",
    "Status",
  ];

  return (
    <div className="route-stack">
      <section className="content-grid">
        <Panel title="Ledger records" eyebrow="Confirmed records">
          <p className="panel-copy">Manual records are written locally as official ledger records. Cloud status appears in the workspace header.</p>
          <button className="secondary-action align-start" type="button" onClick={() => navigate(navItemFor("capture"))}>
            Start a record
          </button>
        </Panel>
        <Panel title={draftCount > 0 ? "Drafts waiting" : "Clean export"} eyebrow="Portability">
          <p className="panel-copy">
            {draftReviewCopy(draftCount)}
          </p>
        </Panel>
      </section>
      {records.length > 0 ? (
        <section className="draft-list" aria-label="Confirmed ledger records">
          <div className="draft-list-heading">
            <div>
              <p className="eyebrow">Official local records</p>
              <h2>Ledger history</h2>
            </div>
            <span>{records.length} record{records.length === 1 ? "" : "s"}</span>
          </div>
          {records.map((record) => (
            <LedgerRecordCard
              key={record.id}
              record={record}
              isEditing={editingRecordId === record.id}
              isEditingUnresolved={editingUnresolvedId === record.id}
              onEdit={() => setEditingRecordId(record.id)}
              onCancelEdit={() => setEditingRecordId(null)}
              onSaveEdit={(patch) => { onUpdateRecord(record.id, patch); setEditingRecordId(null); }}
              onCompleteDetails={() => setEditingUnresolvedId(record.id)}
              onCancelDetails={() => setEditingUnresolvedId(null)}
              onConvertDetails={(fields) => {
                const converted = onConvertUnresolved(record.id, fields);
                if (converted) setEditingUnresolvedId(null);
                return converted;
              }}
              onUpdate={(patch) => onUpdateRecord(record.id, patch)}
              onVoid={() => onVoidRecord(record.id)}
            />
          ))}
        </section>
      ) : null}
      {draftCount > 0 ? (
        <section className="draft-list" aria-label="Draft records waiting for review">
          <div className="draft-list-heading">
            <div>
              <p className="eyebrow">Review queue</p>
              <h2>Drafts waiting</h2>
            </div>
            <span>{draftCount} local draft{draftCount === 1 ? "" : "s"}</span>
          </div>
          {drafts.map((draft) => (
            <article className="draft-card" key={draft.id}>
              <div>
                <strong>{draftDisplayName(draft)}</strong>
                <span>
                  {draft.date} · {draft.account}
                  {draft.kind === "transfer" ? ` · to ${draft.transferAccount}` : ` · ${draft.category}`}
                </span>
              </div>
              <div className="draft-amount">
                <strong>
                  {draft.currency} {draft.amount}
                </strong>
                <span>{draft.kind}</span>
              </div>
              <div className="record-actions">
                <button className="secondary-action" type="button" onClick={() => onEditDraft(draft)}>
                  Continue in Capture
                </button>
                <button
                  className="primary-action"
                  type="button"
                  onClick={() => setDraftMessage(onConfirmDraft(draft) ? "Draft confirmed in the local ledger." : "This draft is incomplete. Continue in Capture to fill the required fields.")}
                >
                  Confirm to ledger
                </button>
                <button className="text-action danger-action" type="button" onClick={() => onDiscardDraft(draft.id)}>
                  Discard
                </button>
              </div>
            </article>
          ))}
        </section>
      ) : null}
        {draftMessage ? <p className="inline-message" aria-live="polite">{draftMessage}</p> : null}
      <section className="table-card" aria-label="Ledger table fields">
        <div className="table-row table-head">
          {ledgerColumns.map((column) => (
            <span key={column}>{column}</span>
          ))}
        </div>
        {records.length === 0 ? <div className="table-empty">No confirmed ledger records yet.</div> : null}
      </section>
    </div>
  );
}

function UnresolvedExpenseEditor({
  record,
  onCancel,
  onConvert,
}: Readonly<{
  record: LocalLedgerRecord;
  onCancel: () => void;
  onConvert: (fields: UnresolvedExpenseConversion) => boolean;
}>) {
  const [localDate, setLocalDate] = useState(record.localDate || record.periodStart);
  const [category, setCategory] = useState(record.category);
  const [counterparty, setCounterparty] = useState(record.counterparty);
  const [counterpartyMissing, setCounterpartyMissing] = useState(record.counterpartyMissing);
  const [itemName, setItemName] = useState(record.itemName);
  const [itemNameMissing, setItemNameMissing] = useState(record.itemNameMissing);
  const [error, setError] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const converted = onConvert({
      localDate,
      category,
      counterparty,
      counterpartyMissing,
      itemName,
      itemNameMissing,
    });

    if (!converted) {
      setError("Add a date, category, and valid merchant/item details before converting.");
    }
  };

  return (
    <form className="record-editor" aria-label={`Complete ${recordDisplayName(record)}`} onSubmit={handleSubmit}>
      <label>
        <span>Date</span>
        <input required type="date" value={localDate} onChange={(event) => setLocalDate(event.target.value)} />
      </label>
      <label>
        <span>Category</span>
        <input required value={category} onChange={(event) => setCategory(event.target.value)} />
      </label>
      <div className="form-field">
        <label htmlFor={`unresolved-merchant-${record.id}`}>Merchant</label>
        <input id={`unresolved-merchant-${record.id}`} required pattern=".*\S.*" disabled={counterpartyMissing} value={counterparty} onChange={(event) => setCounterparty(event.target.value)} />
        <label className="checkbox-field inline-checkbox">
          <input type="checkbox" checked={counterpartyMissing} onChange={(event) => {
            const missing = event.target.checked;
            setCounterpartyMissing(missing);
            setCounterparty(missing ? missingCounterpartyLabel : "");
          }} />
          <span>Merchant unavailable</span>
        </label>
      </div>
      <div className="form-field">
        <label htmlFor={`unresolved-item-${record.id}`}>Item name</label>
        <input id={`unresolved-item-${record.id}`} required pattern=".*\S.*" disabled={itemNameMissing} value={itemName} onChange={(event) => setItemName(event.target.value)} />
        <label className="checkbox-field inline-checkbox">
          <input type="checkbox" checked={itemNameMissing} onChange={(event) => {
            const missing = event.target.checked;
            setItemNameMissing(missing);
            setItemName(missing ? missingItemNameLabel : "");
          }} />
          <span>Item unavailable</span>
        </label>
      </div>
      {error ? <p className="form-error full-span" role="alert">{error}</p> : null}
      <div className="record-editor-actions full-span">
        <button className="primary-action" type="submit">Convert to expense</button>
        <button className="quiet-action" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function RecordEditor({
  record,
  onSave,
  onCancel,
}: Readonly<{
  record: LocalLedgerRecord;
  onSave: (patch: Partial<EditableRecordFields>) => void;
  onCancel: () => void;
}>) {
  const [amount, setAmount] = useState(record.amount);
  const [category, setCategory] = useState(record.category);
  const [counterparty, setCounterparty] = useState(record.counterparty);
  const [itemName, setItemName] = useState(record.itemName);
  const [reason, setReason] = useState(record.reason);
  const [note, setNote] = useState(record.note);

  return (
    <form className="record-editor" aria-label={`Edit ${recordDisplayName(record)}`} onSubmit={(event) => {
      event.preventDefault();
      onSave({ amount, category, counterparty, itemName, reason, note });
    }}>
      <AmountField id="record-editor-amount" label="Amount" required value={amount} allowNegative={record.kind === "adjustment"} onChange={setAmount} />
      <label>
        <span>Category</span>
        <input value={category} onChange={(event) => setCategory(event.target.value)} />
      </label>
      <label>
        <span>Merchant / source</span>
        <input value={counterparty} onChange={(event) => setCounterparty(event.target.value)} />
      </label>
      <label>
        <span>Item name</span>
        <input value={itemName} onChange={(event) => setItemName(event.target.value)} />
      </label>
      <label>
        <span>Reason</span>
        <input value={reason} onChange={(event) => setReason(event.target.value)} />
      </label>
      <label className="full-span">
        <span>Note</span>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <div className="record-editor-actions full-span">
        <button className="primary-action" type="submit">Save changes</button>
        <button className="quiet-action" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function HistorySuggestions({
  records,
  source,
  onApply,
}: Readonly<{
  records: LocalLedgerRecord[];
  source: "merchant" | "item";
  onApply: (field: "counterparty" | "itemName" | "amount" | "account" | "category" | "currency", value: string) => void;
}>) {
  return (
    <section className="history-suggestions" aria-label={source === "merchant" ? "Merchant history suggestions" : "Item history suggestions"}>
      <span className="suggestion-label">Previous records</span>
      {records.map((record) => (
        <div className="suggestion-row" key={record.id}>
          <strong>{source === "merchant" ? record.counterparty : record.itemName}</strong>
          <div className="suggestion-actions">
            {source === "item" ? (
              <SuggestionButton label={`Use merchant ${record.counterparty}`} onClick={() => onApply("counterparty", record.counterparty)} />
            ) : null}
            {source === "merchant" ? (
              <SuggestionButton label={`Use item ${record.itemName}`} onClick={() => onApply("itemName", record.itemName)} />
            ) : null}
            <SuggestionButton label={`Use amount ${record.currency} ${record.amount}`} onClick={() => onApply("amount", record.amount)} />
            <SuggestionButton label={`Use account ${record.accountName}`} onClick={() => onApply("account", record.accountName)} />
            <SuggestionButton label={`Use category ${record.category}`} onClick={() => onApply("category", record.category)} />
            <button className="suggestion-clear" type="button" onClick={() => onApply(source === "merchant" ? "counterparty" : "itemName", "")}>
              Clear {source === "merchant" ? "merchant" : "item"}
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}

function SuggestionButton({ label, onClick }: Readonly<{ label: string; onClick: () => void }>) {
  return <button className="suggestion-button" type="button" onClick={onClick}>{label}</button>;
}

function adjustAmount(value: string, delta: number, allowNegative: boolean): string {
  const current = Number(value);

  if (!Number.isFinite(current)) {
    return delta > 0 || allowNegative ? String(delta) : "";
  }

  return String(allowNegative ? current + delta : Math.max(0, current + delta));
}

function AmountField({
  id,
  label,
  value,
  required = false,
  allowNegative = false,
  placeholder = "100",
  onChange,
}: Readonly<{
  id: string;
  label: string;
  value: string;
  required?: boolean;
  allowNegative?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}>) {
  const steps = [-1000, -100, -10, 10, 100, 1000];
  const visibleSteps = allowNegative || value.trim() ? steps : steps.filter((step) => step > 0);
  const currentAmount = Number(value);

  return (
    <div className="form-field amount-field">
      <label htmlFor={id}>
        <span>{label}</span>
      </label>
      <div className="amount-control">
        <input
          id={id}
          required={required}
          inputMode="decimal"
          min={allowNegative ? undefined : "0"}
          step="1"
          type="number"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
        <div className={`amount-steps ${visibleSteps.length === 3 ? "positive-only" : ""}`} aria-label={`${label} quick amount changes`}>
          {visibleSteps.map((step) => (
            <button
              key={step}
              className="amount-step"
              type="button"
              aria-label={`${step > 0 ? "Increase" : "Decrease"} ${label} by ${Math.abs(step)}`}
              disabled={!allowNegative && step < 0 && (!Number.isFinite(currentAmount) || currentAmount <= 0)}
              onClick={() => onChange(adjustAmount(value, step, allowNegative))}
            >
              {formatAmountStep(step)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuickAccountSetup({
  accountName,
  currency,
  accountType = "cash",
  allowNegativeBalance = true,
  initialBalance,
  initialBalanceDate,
  error,
  onAccountNameChange,
  onCurrencyChange,
  onAccountTypeChange,
  onAllowNegativeBalanceChange,
  onInitialBalanceChange,
  onInitialBalanceDateChange,
  onConfirm,
  onCancel,
}: Readonly<{
  accountName: string;
  currency: string;
  accountType?: string;
  allowNegativeBalance?: boolean;
  initialBalance: string;
  initialBalanceDate: string;
  error: string;
  onAccountNameChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  onAccountTypeChange?: (value: string) => void;
  onAllowNegativeBalanceChange?: (value: boolean) => void;
  onInitialBalanceChange: (value: string) => void;
  onInitialBalanceDateChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}>) {
  return (
    <div className="quick-account-backdrop">
    <dialog className="quick-account" aria-label="Add account" open>
      <QuickAccountHeading />
      <QuickAccountFields
        accountName={accountName}
        currency={currency}
        accountType={accountType}
        allowNegativeBalance={allowNegativeBalance}
        initialBalance={initialBalance}
        initialBalanceDate={initialBalanceDate}
        onAccountNameChange={onAccountNameChange}
        onCurrencyChange={onCurrencyChange}
        onAccountTypeChange={onAccountTypeChange}
        onAllowNegativeBalanceChange={onAllowNegativeBalanceChange}
        onInitialBalanceChange={onInitialBalanceChange}
        onInitialBalanceDateChange={onInitialBalanceDateChange}
      />
      <QuickAccountActions onConfirm={onConfirm} onCancel={onCancel} />
      {error ? <p className="quick-account-error" role="alert">{error}</p> : null}
    </dialog>
    </div>
  );
}

function QuickAccountHeading() {
  return (
    <header className="quick-account-heading">
      <div>
        <span className="eyebrow">New account</span>
        <h3>Add an account</h3>
      </div>
      <p>Set the account details before using it in this record.</p>
    </header>
  );
}

function QuickAccountFields({
  accountName,
  currency,
  accountType,
  allowNegativeBalance,
  initialBalance,
  initialBalanceDate,
  onAccountNameChange,
  onCurrencyChange,
  onAccountTypeChange,
  onAllowNegativeBalanceChange,
  onInitialBalanceChange,
  onInitialBalanceDateChange,
}: Readonly<{
  accountName: string;
  currency: string;
  accountType: string;
  allowNegativeBalance: boolean;
  initialBalance: string;
  initialBalanceDate: string;
  onAccountNameChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  onAccountTypeChange?: (value: string) => void;
  onAllowNegativeBalanceChange?: (value: boolean) => void;
  onInitialBalanceChange: (value: string) => void;
  onInitialBalanceDateChange: (value: string) => void;
}>) {
  return (
    <>
      <label>
        <span>Account name</span>
        <input required value={accountName} onChange={(event) => onAccountNameChange(event.target.value)} placeholder="Daily wallet" />
      </label>
      <label>
        <span>Currency</span>
        <select value={currency} onChange={(event) => onCurrencyChange(event.target.value)}>
          <option value="TWD">TWD</option>
          <option value="JPY">JPY</option>
          <option value="USD">USD</option>
        </select>
      </label>
      <label>
        <span>Account type</span>
        <select value={accountType} onChange={(event) => onAccountTypeChange?.(event.target.value)}>
          <option value="cash">Cash</option>
          <option value="bank">Bank account</option>
          <option value="card">Credit card</option>
          <option value="wallet">Stored-value wallet</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className="checkbox-row">
        <input type="checkbox" checked={allowNegativeBalance} onChange={(event) => onAllowNegativeBalanceChange?.(event.target.checked)} />
        <span>Allow negative balance</span>
      </label>
      <AmountField id="quick-account-initial-balance" label="Initial balance (optional)" value={initialBalance} onChange={onInitialBalanceChange} placeholder="Leave blank to start from zero" />
      {initialBalance.trim() ? <label>
        <span>Balance as of</span>
        <input type="date" required value={initialBalanceDate} onChange={(event) => onInitialBalanceDateChange(event.target.value)} />
      </label> : null}
    </>
  );
}

function QuickAccountActions({ onConfirm, onCancel }: Readonly<{ onConfirm: () => void; onCancel: () => void }>) {
  return (
    <div className="quick-account-actions">
      <button className="primary-action" type="button" onClick={onConfirm}>Add and select</button>
      <button className="quiet-action" type="button" onClick={onCancel}>Cancel</button>
    </div>
  );
}

function useMealCapture(
  onSaveMeal: (meal: MealEntry) => void,
  onQueueUploads: (items: UploadQueueItem[]) => void,
) {
  const [mealOccurredAt, setMealOccurredAt] = useState(localDateTime);
  const [mealNote, setMealNote] = useState("");
  const [mealPhotoFiles, setMealPhotoFiles] = useState<File[]>([]);
  const [mealError, setMealError] = useState("");
  const [mealSavedMessage, setMealSavedMessage] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);

  const appendMealPhotos = (files: PhotoInput) => {
    const incoming = Array.from(files ?? []);
    if (incoming.length === 0) return;
    setMealPhotoFiles((current) => {
      const existing = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
      return [...current, ...incoming.filter((file) => !existing.has(`${file.name}:${file.size}:${file.lastModified}`))];
    });
    setMealError("");
  };

  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
    setIsCameraOpen(false);
  };

  useEffect(() => () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (!isCameraOpen || !cameraStreamRef.current || !cameraVideoRef.current) return;
    try {
      cameraVideoRef.current.srcObject = cameraStreamRef.current;
    } catch {
      setCameraError("Camera preview could not start. You can still use Choose photos.");
      return;
    }
    const playResult = cameraVideoRef.current.play();
    if (playResult && typeof playResult.catch === "function") {
      playResult.catch(() => setCameraError("Camera preview could not start. You can still use Choose photos."));
    }
  }, [isCameraOpen]);

  const openCamera = async () => {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser does not support direct camera capture. Use Choose photos instead.");
      return;
    }
    try {
      cameraStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" } } });
      setIsCameraOpen(true);
    } catch {
      cameraStreamRef.current = null;
      setCameraError("Camera permission was denied or the camera is unavailable. Use Choose photos instead.");
    }
  };

  const captureCameraPhoto = () => {
    const video = cameraVideoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError("The camera preview is not ready yet. Try again in a moment.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError("The photo could not be created. Use Choose photos instead.");
        return;
      }
      appendMealPhotos([new File([blob], `meal-${Date.now()}.jpg`, { type: "image/jpeg" })]);
      stopCamera();
    }, "image/jpeg", 0.92);
  };

  const handleMealSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const mediaValidation = validateMediaBatch(mealPhotoFiles);
    if (!mediaValidation.ok) {
      setMealError(mediaValidation.error ?? "The selected photos exceed the upload limit.");
      return;
    }
    const mealId = `meal-${crypto.randomUUID()}`;
    const queuedMedia = queueUploadFiles(mealPhotoFiles, mealId, "meal-photo");
    const meal = createMealEntry({ occurredAt: mealOccurredAt, note: mealNote, mediaAssetIds: queuedMedia.map((item) => item.id) }, mealId);
    if (!meal) {
      setMealError("Choose a meal time before saving.");
      return;
    }
    onSaveMeal(meal);
    onQueueUploads(queuedMedia);
    setMealError("");
    setMealSavedMessage(`Meal saved locally with ${meal.mediaAssetIds.length} photo${meal.mediaAssetIds.length === 1 ? "" : "s"}.`);
    setMealNote("");
    setMealPhotoFiles([]);
  };

  return {
    mealOccurredAt,
    setMealOccurredAt,
    mealNote,
    setMealNote,
    mealPhotoFiles,
    mealError,
    setMealError,
    mealSavedMessage,
    isCameraOpen,
    cameraError,
    cameraVideoRef,
    appendMealPhotos,
    stopCamera,
    openCamera,
    captureCameraPhoto,
    handleMealSubmit,
  };
}

function useScanCapture(
  captureIntent: CaptureIntent,
  onSaveScans: (scans: TemporaryScan[]) => void,
  onQueueUploads: (items: UploadQueueItem[]) => void,
) {
  const [scanFiles, setScanFiles] = useState<File[]>([]);
  const [scanError, setScanError] = useState("");
  const [scanSavedMessage, setScanSavedMessage] = useState("");

  const handleScanSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setScanError("");
    setScanSavedMessage("");
    if (scanFiles.length === 0 || (captureIntent !== "scan-invoice" && captureIntent !== "scan-receipt")) {
      setScanError("Choose at least one scan image before saving.");
      return;
    }
    const mediaValidation = validateMediaBatch(scanFiles);
    if (!mediaValidation.ok) {
      setScanError(mediaValidation.error ?? "The selected scans exceed the upload limit.");
      return;
    }
    const queuedMedia = queueUploadFiles(scanFiles, `scan-${crypto.randomUUID()}`, captureIntent === "scan-invoice" ? "invoice-scan" : "receipt-scan");
    const nextScans = scanFiles
      .map((file, index) => createTemporaryScan({ intent: captureIntent, fileName: file.name, mimeType: file.type, byteSize: file.size }, queuedMedia[index].id))
      .filter((scan): scan is TemporaryScan => Boolean(scan));
    onSaveScans(nextScans);
    onQueueUploads(queuedMedia);
    setScanFiles([]);
    setScanSavedMessage(`${nextScans.length} scan draft${nextScans.length === 1 ? "" : "s"} saved locally for review.`);
  };

  return { scanFiles, setScanFiles, scanError, setScanError, scanSavedMessage, handleScanSubmit };
}

function CaptureStartPanel({
  captureIntent,
  selectedCaptureAction,
  actionIcons,
  onSelectIntent,
}: Readonly<{
  captureIntent: CaptureIntent;
  selectedCaptureAction: (typeof captureIntents)[number];
  actionIcons: Record<CaptureIntent, LucideIcon>;
  onSelectIntent: (intent: CaptureIntent) => void;
}>) {
  return (
    <section className="capture-start" aria-labelledby="capture-start-title">
      <div className="capture-start-heading">
        <div>
          <p className="eyebrow">Quick capture</p>
          <h2 id="capture-start-title">What are you saving?</h2>
        </div>
        <p className="capture-start-detail">{selectedCaptureAction.detail}</p>
      </div>
      <div className="capture-intent-picker" role="toolbar" aria-label="Capture type">
        {captureIntents.map((action) => {
          const Icon = actionIcons[action.id];
          const selected = captureIntent === action.id;
          return (
            <button
              aria-pressed={selected}
              className={`capture-intent-button ${selected ? "selected" : ""}`}
              type="button"
              key={action.id}
              onClick={() => onSelectIntent(action.id)}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

type ManualLedgerFormProps = {
  form: DraftForm;
  accounts: LocalAccount[];
  hasSelectedAccount: boolean;
  isUnresolvedExpense: boolean;
  isTransfer: boolean;
  needsCategory: boolean;
  categoryOptions: string[];
  needsCounterparty: boolean;
  counterpartyLabel: string;
  sourceOptions: string[];
  refundableRecords: LocalLedgerRecord[];
  selectedRefundIds: string[];
  selectedRefundHasDifferentCurrency: boolean;
  refundDifferenceNeedsClassification: boolean;
  refundDifferenceLabel: string;
  merchantSuggestions: LocalLedgerRecord[];
  itemSuggestions: LocalLedgerRecord[];
  supportsRecurrence: boolean;
  autoRecordAllowed: boolean;
  hasUnsavedChanges: boolean;
  showCancelChoices: boolean;
  formError: string | null;
  savedMessage: string;
  quickAccountField: QuickAccountField | null;
  quickAccountProps: React.ComponentProps<typeof QuickAccountSetup>;
  isAddingCategory: boolean;
  quickCategoryName: string;
  quickCategoryError: string;
  isAddingSource: boolean;
  quickSourceName: string;
  quickSourceError: string;
  setForm: Dispatch<SetStateAction<DraftForm>>;
  setFormError: Dispatch<SetStateAction<string | null>>;
  setSavedMessage: Dispatch<SetStateAction<string>>;
  updateForm: (field: keyof DraftForm, value: string) => void;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
  beginQuickAccountSetup: (field: QuickAccountField) => void;
  setTimePrecision: (precision: DraftForm["timePrecision"]) => void;
  setMonthRange: (month: string) => void;
  selectSourceAccount: (name: string) => void;
  selectDestinationAccount: (name: string) => void;
  selectFeeAccount: (name: string) => void;
  setTransferMode: (mode: DraftForm["transferMode"]) => void;
  setRecordKind: (kind: DraftForm["kind"]) => void;
  setMissingExpenseField: (field: "counterparty" | "itemName", missing: boolean) => void;
  applySuggestion: (field: "counterparty" | "itemName" | "amount" | "account" | "category" | "currency", value: string) => void;
  setIsAddingCategory: Dispatch<SetStateAction<boolean>>;
  setQuickCategoryName: Dispatch<SetStateAction<string>>;
  setQuickCategoryError: Dispatch<SetStateAction<string>>;
  addQuickCategory: () => void;
  setIsAddingSource: Dispatch<SetStateAction<boolean>>;
  setQuickSourceName: Dispatch<SetStateAction<string>>;
  setQuickSourceError: Dispatch<SetStateAction<string>>;
  addQuickSource: () => void;
  resetEntry: () => void;
  keepEntryAsDraft: () => void;
  setShowCancelChoices: Dispatch<SetStateAction<boolean>>;
};

type ManualLedgerDetailsProps = Pick<ManualLedgerFormProps,
  | "form"
  | "accounts"
  | "isTransfer"
  | "needsCategory"
  | "categoryOptions"
  | "needsCounterparty"
  | "counterpartyLabel"
  | "sourceOptions"
  | "refundableRecords"
  | "selectedRefundIds"
  | "selectedRefundHasDifferentCurrency"
  | "refundDifferenceNeedsClassification"
  | "refundDifferenceLabel"
  | "merchantSuggestions"
  | "itemSuggestions"
  | "quickAccountField"
  | "quickAccountProps"
  | "isAddingCategory"
  | "quickCategoryName"
  | "quickCategoryError"
  | "isAddingSource"
  | "quickSourceName"
  | "quickSourceError"
  | "setForm"
  | "updateForm"
  | "beginQuickAccountSetup"
  | "selectDestinationAccount"
  | "selectFeeAccount"
  | "setTransferMode"
  | "setMissingExpenseField"
  | "applySuggestion"
  | "setIsAddingCategory"
  | "setQuickCategoryName"
  | "setQuickCategoryError"
  | "addQuickCategory"
  | "setIsAddingSource"
  | "setQuickSourceName"
  | "setQuickSourceError"
  | "addQuickSource"
>;

type ManualLedgerPartyFieldsProps = Pick<ManualLedgerDetailsProps,
  | "form" | "needsCategory" | "categoryOptions" | "needsCounterparty" | "counterpartyLabel" | "sourceOptions"
  | "refundableRecords" | "selectedRefundIds" | "merchantSuggestions" | "itemSuggestions" | "isAddingCategory"
  | "quickCategoryName" | "quickCategoryError" | "isAddingSource" | "quickSourceName" | "quickSourceError"
  | "setForm" | "updateForm" | "setMissingExpenseField" | "applySuggestion" | "setIsAddingCategory"
  | "setQuickCategoryName" | "setQuickCategoryError" | "addQuickCategory" | "setIsAddingSource"
  | "setQuickSourceName" | "setQuickSourceError" | "addQuickSource"
>;

function ManualLedgerPartyFields({
  form, needsCategory, categoryOptions, needsCounterparty, counterpartyLabel, sourceOptions, refundableRecords,
  selectedRefundIds, merchantSuggestions, itemSuggestions, isAddingCategory, quickCategoryName, quickCategoryError,
  isAddingSource, quickSourceName, quickSourceError, setForm, updateForm, setMissingExpenseField, applySuggestion,
  setIsAddingCategory, setQuickCategoryName, setQuickCategoryError, addQuickCategory, setIsAddingSource,
  setQuickSourceName, setQuickSourceError, addQuickSource,
}: Readonly<ManualLedgerPartyFieldsProps>) {
  return (
    <>
      {needsCategory ? (
        <div className="form-field">
          <label htmlFor="entry-category"><span>Category</span></label>
          <div className="field-control-row">
            <select id="entry-category" required value={form.category} onChange={(event) => updateForm("category", event.target.value)}>
              <option value="">Select a category</option>
              {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <button className="icon-button" type="button" aria-label="Add category" title="Add category" onClick={() => { setIsAddingCategory(true); setQuickCategoryError(""); }}>
              <Plus size={18} aria-hidden="true" />
            </button>
          </div>
          {isAddingCategory ? (
            <section className="quick-category" aria-label="Quick category setup">
              <label><span>New category name</span><input value={quickCategoryName} onChange={(event) => { setQuickCategoryName(event.target.value); setQuickCategoryError(""); }} placeholder="Household" /></label>
              <div className="quick-account-actions">
                <button className="primary-action" type="button" onClick={addQuickCategory}>Add and select</button>
                <button className="quiet-action" type="button" onClick={() => { setIsAddingCategory(false); setQuickCategoryError(""); }}>Cancel</button>
              </div>
              {quickCategoryError ? <p className="quick-account-error" role="alert">{quickCategoryError}</p> : null}
            </section>
          ) : null}
        </div>
      ) : null}
      {needsCounterparty ? (
        <ManualLedgerCounterpartyField
          form={form}
          counterpartyLabel={counterpartyLabel}
          sourceOptions={sourceOptions}
          merchantSuggestions={merchantSuggestions}
          isAddingSource={isAddingSource}
          quickSourceName={quickSourceName}
          quickSourceError={quickSourceError}
          updateForm={updateForm}
          setMissingExpenseField={setMissingExpenseField}
          applySuggestion={applySuggestion}
          setIsAddingSource={setIsAddingSource}
          setQuickSourceName={setQuickSourceName}
          setQuickSourceError={setQuickSourceError}
          addQuickSource={addQuickSource}
        />
      ) : null}
      {form.kind === "refund" ? (
        <>
          <label><span>Refund type</span><select value={form.refundSubtype} onChange={(event) => updateForm("refundSubtype", event.target.value as DraftForm["refundSubtype"])}><option value="refund">Store refund</option><option value="payback">Friend payback</option></select></label>
          {form.refundSubtype === "payback" ? (
            <label htmlFor="entry-refund-links"><span>Original expense</span><select id="entry-refund-links" aria-label="Original expense" required multiple value={selectedRefundIds} onChange={(event) => { const ids = [...event.target.selectedOptions].map((option) => option.value).filter(Boolean); setForm((current) => ({ ...current, refundLinkedRecordId: ids[0] ?? "", refundLinkedRecordIds: ids })); }}><option value="">Select an expense to link</option>{refundableRecords.map((record) => <option key={record.id} value={record.id}>{record.localDate} · {record.counterparty} · {record.currency} {record.amount}</option>)}</select><small>Select one or more expenses when a payback settles multiple shared expenses.</small></label>
          ) : null}
        </>
      ) : null}
      {form.kind === "expense" ? (
        <div className="form-field">
          <label htmlFor="entry-item-name"><span>Item name</span></label>
          <input id="entry-item-name" required pattern=".*\S.*" disabled={form.itemNameMissing} value={form.itemName} onChange={(event) => updateForm("itemName", event.target.value)} />
          <label className="checkbox-field inline-checkbox"><input type="checkbox" checked={form.itemNameMissing} onChange={(event) => setMissingExpenseField("itemName", event.target.checked)} /><span>Item unavailable</span></label>
          {itemSuggestions.length > 0 && !form.itemNameMissing ? <HistorySuggestions records={itemSuggestions} source="item" onApply={applySuggestion} /> : null}
        </div>
      ) : null}
    </>
  );
}

type ManualLedgerCounterpartyFieldProps = Pick<ManualLedgerPartyFieldsProps,
  | "form" | "counterpartyLabel" | "sourceOptions" | "merchantSuggestions" | "isAddingSource"
  | "quickSourceName" | "quickSourceError" | "updateForm" | "setMissingExpenseField" | "applySuggestion"
  | "setIsAddingSource" | "setQuickSourceName" | "setQuickSourceError" | "addQuickSource"
>;

function ManualLedgerCounterpartyField({
  form, counterpartyLabel, sourceOptions, merchantSuggestions, isAddingSource, quickSourceName, quickSourceError,
  updateForm, setMissingExpenseField, applySuggestion, setIsAddingSource, setQuickSourceName, setQuickSourceError,
  addQuickSource,
}: Readonly<ManualLedgerCounterpartyFieldProps>) {
  const isIncomeSource = form.kind === "income" || form.kind === "fund-addition";
  if (isIncomeSource) {
    return (
      <div className="form-field">
        <label htmlFor="entry-source">Source</label>
        <div className="field-control-row">
          <select id="entry-source" required value={form.counterparty} onChange={(event) => updateForm("counterparty", event.target.value)}>
            <option value="">Select a source</option>
            {sourceOptions.map((source) => <option key={source} value={source}>{source}</option>)}
          </select>
          <button className="icon-button" type="button" aria-label="Add source" title="Add source" onClick={() => { setIsAddingSource(true); setQuickSourceError(""); }}>
            <Plus size={18} aria-hidden="true" />
          </button>
        </div>
        {isAddingSource ? (
          <section className="quick-category" aria-label="Quick source setup">
            <label htmlFor="quick-source-name">New source</label>
            <input id="quick-source-name" required value={quickSourceName} onChange={(event) => { setQuickSourceName(event.target.value); setQuickSourceError(""); }} placeholder="Parent" />
            <div className="quick-account-actions">
              <button className="primary-action" type="button" onClick={addQuickSource}>Add and select</button>
              <button className="quiet-action" type="button" onClick={() => { setIsAddingSource(false); setQuickSourceError(""); }}>Cancel</button>
            </div>
            {quickSourceError ? <p className="quick-account-error" role="alert">{quickSourceError}</p> : null}
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="form-field">
      <label htmlFor="entry-counterparty"><span>{counterpartyLabel}</span></label>
      <input id="entry-counterparty" required pattern=".*\S.*" title={`Enter a ${counterpartyLabel.toLocaleLowerCase()}.`} value={form.counterparty} disabled={form.kind === "expense" && form.counterpartyMissing} onChange={(event) => updateForm("counterparty", event.target.value)} />
      {form.kind === "expense" ? <label className="checkbox-field inline-checkbox"><input type="checkbox" checked={form.counterpartyMissing} onChange={(event) => setMissingExpenseField("counterparty", event.target.checked)} /><span>Merchant unavailable</span></label> : null}
      {form.kind === "expense" && merchantSuggestions.length > 0 && !form.counterpartyMissing ? <HistorySuggestions records={merchantSuggestions} source="merchant" onApply={applySuggestion} /> : null}
    </div>
  );
}

type ManualLedgerMoneyFieldsProps = Pick<ManualLedgerDetailsProps,
  | "form" | "accounts" | "isTransfer" | "quickAccountField" | "quickAccountProps" | "selectedRefundHasDifferentCurrency"
  | "refundDifferenceNeedsClassification" | "refundDifferenceLabel" | "setForm" | "updateForm" | "beginQuickAccountSetup"
  | "selectDestinationAccount" | "selectFeeAccount" | "setTransferMode"
>;

function ManualLedgerMoneyFields({
  form, accounts, isTransfer, quickAccountField, quickAccountProps, selectedRefundHasDifferentCurrency,
  refundDifferenceNeedsClassification, refundDifferenceLabel, setForm, updateForm, beginQuickAccountSetup,
  selectDestinationAccount, selectFeeAccount, setTransferMode,
}: Readonly<ManualLedgerMoneyFieldsProps>) {
  return (
    <>
      {isTransfer ? <TransferFields form={form} accounts={accounts} quickAccountField={quickAccountField} quickAccountProps={quickAccountProps} onBeginQuickAccountSetup={beginQuickAccountSetup} onSelectDestinationAccount={selectDestinationAccount} onSetTransferMode={setTransferMode} /> : null}
      <AmountField id="entry-amount" label={isTransfer && form.transferMode === "cross-currency" ? "Source amount" : "Amount"} required value={form.amount} allowNegative={form.kind === "adjustment"} onChange={(value) => updateForm("amount", value)} />
      <div className="form-field"><span>{isTransfer && form.transferMode === "cross-currency" ? "Source currency" : "Currency"}</span><output className="derived-value">{form.currency}</output></div>
      {isTransfer && form.transferMode === "cross-currency" ? <><AmountField id="entry-destination-amount" label="Destination amount" required value={form.destinationAmount} onChange={(value) => updateForm("destinationAmount", value)} /><div className="form-field"><span>Destination currency</span><output className="derived-value">{form.destinationCurrency}</output></div></> : null}
      {isTransfer ? <label className="full-span checkbox-field"><input type="checkbox" checked={form.feeEnabled} onChange={(event) => setForm((current) => ({ ...current, feeEnabled: event.target.checked }))} /><span>Add transfer fee</span></label> : null}
      {isTransfer && form.feeEnabled ? <FeeFields form={form} accounts={accounts} quickAccountField={quickAccountField} quickAccountProps={quickAccountProps} onBeginQuickAccountSetup={beginQuickAccountSetup} onSelectFeeAccount={selectFeeAccount} onUpdateForm={updateForm} /> : null}
      {form.kind === "refund" ? <RefundFields form={form} selectedRefundHasDifferentCurrency={selectedRefundHasDifferentCurrency} refundDifferenceNeedsClassification={refundDifferenceNeedsClassification} refundDifferenceLabel={refundDifferenceLabel} updateForm={updateForm} /> : null}
      {form.kind === "adjustment" ? <label className="full-span"><span>Adjustment reason</span><textarea required value={form.reason} onChange={(event) => updateForm("reason", event.target.value)} /></label> : null}
    </>
  );
}

function RefundFields({ form, selectedRefundHasDifferentCurrency, refundDifferenceNeedsClassification, refundDifferenceLabel, updateForm }: Readonly<Pick<ManualLedgerMoneyFieldsProps, "form" | "selectedRefundHasDifferentCurrency" | "refundDifferenceNeedsClassification" | "refundDifferenceLabel" | "updateForm">>) {
  const differenceDescription = selectedRefundHasDifferentCurrency
    ? "The linked expense uses another currency; classify the difference before saving this payback."
    : "This payback exceeds the linked expense and needs an explicit classification.";
  return (
    <>
      <label className="full-span"><span>Refund reason</span><textarea required value={form.refundReason} onChange={(event) => updateForm("refundReason", event.target.value)} /></label>
      {refundDifferenceNeedsClassification ? (
        <label className="full-span warning-field">
          <span>{refundDifferenceLabel}</span>
          <select aria-label={refundDifferenceLabel} value={form.refundExcessHandling} onChange={(event) => updateForm("refundExcessHandling", event.target.value as DraftForm["refundExcessHandling"])}>
            <option value="unclassified">Choose a classification</option>
            <option value="income">Classify excess as income</option>
            <option value="negative-expense">Classify excess as additional negative expense</option>
            <option value="exchange_difference">Classify as exchange difference</option>
          </select>
          <small>{differenceDescription}</small>
        </label>
      ) : null}
    </>
  );
}

function ManualLedgerDetails(props: Readonly<ManualLedgerDetailsProps>) {
  return (
    <fieldset className="entry-details">
      <ManualLedgerPartyFields {...props} />
      <ManualLedgerMoneyFields {...props} />
    </fieldset>
  );
}

type ManualLedgerTimingFieldsProps = Pick<ManualLedgerFormProps, "form" | "isUnresolvedExpense" | "setTimePrecision" | "setMonthRange" | "updateForm"> & {
  hasSelectedAccount: boolean;
};

type ManualLedgerAccountFieldProps = Pick<ManualLedgerFormProps, "form" | "accounts" | "isTransfer" | "quickAccountField" | "quickAccountProps" | "beginQuickAccountSetup" | "selectSourceAccount">;

function ManualLedgerAccountField({
  form, accounts, isTransfer, quickAccountField, quickAccountProps, beginQuickAccountSetup, selectSourceAccount,
}: Readonly<ManualLedgerAccountFieldProps>) {
  return (
    <div className={`form-field entry-account-field ${isTransfer ? "" : "entry-account-last"}`}>
      <label htmlFor="entry-account"><span>{isTransfer ? "Source account" : "Account"}</span></label>
      <div className="field-control-row">
        <select id="entry-account" required disabled={accounts.length === 0} value={form.account} onChange={(event) => selectSourceAccount(event.target.value)}>
          <option value="">{accounts.length === 0 ? "Add an account" : "Select an account"}</option>
          {accounts.map((account) => <option key={account.id} value={account.name}>{account.name} ({account.currency})</option>)}
        </select>
        <button className="icon-button" type="button" aria-label="Add account" title="Add account" onClick={() => beginQuickAccountSetup("account")}><Plus size={18} aria-hidden="true" /></button>
      </div>
      {accounts.length === 0 ? <p className="field-help">Add an account to start recording.</p> : null}
      {quickAccountField === "account" ? <QuickAccountSetup {...quickAccountProps} /> : null}
    </div>
  );
}

function ManualLedgerTimingFields({
  form, hasSelectedAccount, isUnresolvedExpense, setTimePrecision, setMonthRange, updateForm,
}: Readonly<ManualLedgerTimingFieldsProps>) {
  return (
    <>
      {hasSelectedAccount && !isUnresolvedExpense ? <label className="entry-date-field"><span>Date</span><input required type="date" value={form.date} onChange={(event) => updateForm("date", event.target.value)} /></label> : null}
      {hasSelectedAccount && isUnresolvedExpense ? (
        <section className="full-span time-precision-fields" aria-label="Unresolved expense timing">
          <fieldset className="segmented-fieldset">
            <legend>Time precision</legend>
            <div className="segmented-control">
              {(["day", "month", "period"] as const).map((precision) => (
                <label className={form.timePrecision === precision ? "active" : ""} key={precision}>
                  <input checked={form.timePrecision === precision} name="time-precision" type="radio" value={precision} onChange={() => setTimePrecision(precision)} />
                  <span>{timePrecisionLabel(precision)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {form.timePrecision === "day" ? <label><span>Date</span><input required type="date" value={form.date} onChange={(event) => updateForm("date", event.target.value)} /></label> : null}
          {form.timePrecision === "month" ? <label><span>Month to record</span><input required type="month" value={form.periodStart.slice(0, 7)} onChange={(event) => setMonthRange(event.target.value)} /></label> : null}
          {form.timePrecision === "period" ? <div className="period-range"><label><span>Period start</span><input required type="date" value={form.periodStart} onChange={(event) => updateForm("periodStart", event.target.value)} /></label><label><span>Period end</span><input required type="date" value={form.periodEnd} onChange={(event) => updateForm("periodEnd", event.target.value)} /></label></div> : null}
        </section>
      ) : null}
    </>
  );
}


function ManualLedgerForm(props: Readonly<ManualLedgerFormProps>) {
  const {
    form, accounts, hasSelectedAccount, isUnresolvedExpense, isTransfer, needsCategory, categoryOptions,
    needsCounterparty, counterpartyLabel, sourceOptions, refundableRecords, selectedRefundIds,
    selectedRefundHasDifferentCurrency, refundDifferenceNeedsClassification, refundDifferenceLabel,
    merchantSuggestions, itemSuggestions, supportsRecurrence, autoRecordAllowed, hasUnsavedChanges,
    showCancelChoices, formError, savedMessage, quickAccountField, quickAccountProps, isAddingCategory, quickCategoryName,
    quickCategoryError, isAddingSource, quickSourceName,
     quickSourceError, setForm, setFormError, setSavedMessage, updateForm, handleSubmit, beginQuickAccountSetup, setTimePrecision, setMonthRange,
    selectSourceAccount, selectDestinationAccount, selectFeeAccount, setTransferMode, setRecordKind,
    setMissingExpenseField, applySuggestion, setIsAddingCategory, setQuickCategoryName, setQuickCategoryError,
    addQuickCategory, setIsAddingSource, setQuickSourceName, setQuickSourceError, addQuickSource, resetEntry,
    keepEntryAsDraft, setShowCancelChoices,
  } = props;
  return (
    <form className={`draft-form ${hasSelectedAccount ? "has-selected-account" : "needs-account"}`} id="manual-draft-form" onSubmit={handleSubmit}>
              <ManualLedgerTimingFields form={form} hasSelectedAccount={hasSelectedAccount} isUnresolvedExpense={isUnresolvedExpense} setTimePrecision={setTimePrecision} setMonthRange={setMonthRange} updateForm={updateForm} />
              <ManualLedgerAccountField form={form} accounts={accounts} isTransfer={isTransfer} quickAccountField={quickAccountField} quickAccountProps={quickAccountProps} beginQuickAccountSetup={beginQuickAccountSetup} selectSourceAccount={selectSourceAccount} />
              {hasSelectedAccount ? (
                <label className="entry-kind-field">
                  <span>Type</span>
                  <select value={form.kind} onChange={(event) => setRecordKind(event.target.value as DraftForm["kind"])}>
                    {draftKinds.map((kind) => (
                      <option key={kind} value={kind}>
                        {kindLabel(kind)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {hasSelectedAccount ? (
                <ManualLedgerDetails
                  form={form}
                  accounts={accounts}
                  isTransfer={isTransfer}
                  needsCategory={needsCategory}
                  categoryOptions={categoryOptions}
                  needsCounterparty={needsCounterparty}
                  counterpartyLabel={counterpartyLabel}
                  sourceOptions={sourceOptions}
                  refundableRecords={refundableRecords}
                  selectedRefundIds={selectedRefundIds}
                  selectedRefundHasDifferentCurrency={selectedRefundHasDifferentCurrency}
                  refundDifferenceNeedsClassification={refundDifferenceNeedsClassification}
                  refundDifferenceLabel={refundDifferenceLabel}
                  merchantSuggestions={merchantSuggestions}
                  itemSuggestions={itemSuggestions}
                  quickAccountField={quickAccountField}
                  quickAccountProps={quickAccountProps}
                  isAddingCategory={isAddingCategory}
                  quickCategoryName={quickCategoryName}
                  quickCategoryError={quickCategoryError}
                  isAddingSource={isAddingSource}
                  quickSourceName={quickSourceName}
                  quickSourceError={quickSourceError}
                  setForm={setForm}
                  updateForm={updateForm}
                  beginQuickAccountSetup={beginQuickAccountSetup}
                  selectDestinationAccount={selectDestinationAccount}
                  selectFeeAccount={selectFeeAccount}
                  setTransferMode={setTransferMode}
                  setMissingExpenseField={setMissingExpenseField}
                  applySuggestion={applySuggestion}
                  setIsAddingCategory={setIsAddingCategory}
                  setQuickCategoryName={setQuickCategoryName}
                  setQuickCategoryError={setQuickCategoryError}
                  addQuickCategory={addQuickCategory}
                  setIsAddingSource={setIsAddingSource}
                  setQuickSourceName={setQuickSourceName}
                  setQuickSourceError={setQuickSourceError}
                  addQuickSource={addQuickSource}
                />
              ) : (
                <div className="entry-details-locked full-span" aria-live="polite">
                  <strong>Select an account to continue</strong>
                  <span>Choose an existing account or use the plus button above. The record fields will appear next.</span>
                </div>
              )}
              {supportsRecurrence && hasSelectedAccount ? (
                <fieldset className="recurrence-control full-span" aria-label="Recurrence">
                  <legend>Next cycle</legend>
                  <label htmlFor="entry-recurrence-choice">
                    <span>Record behavior</span>
                  </label>
                  <select
                    id="entry-recurrence-choice"
                    disabled={!hasSelectedAccount}
                    value={form.recurrenceChoice}
                    onChange={(event) => updateForm("recurrenceChoice", event.target.value as DraftForm["recurrenceChoice"])}
                  >
                    <option value="current-cycle-only">Current cycle only</option>
                    <option value="prompt-next-cycle">Ask me next cycle</option>
                    <option value="auto-record-next-cycle" disabled={!autoRecordAllowed}>Auto-record next cycle</option>
                  </select>
                  <label className="checkbox-field inline-checkbox">
                    <input
                      type="checkbox"
                      checked={form.recurrenceAmountMode === "variable"}
                      disabled={!hasSelectedAccount}
                      onChange={(event) => {
                        const variable = event.target.checked;
                        setFormError(null);
                        setSavedMessage("");
                        setForm((current) => ({
                          ...current,
                          recurrenceAmountMode: variable ? "variable" : "fixed",
                          recurrenceChoice: variable && current.recurrenceChoice === "auto-record-next-cycle" ? "prompt-next-cycle" : current.recurrenceChoice,
                        }));
                      }}
                    />
                    <span>Amount may vary next cycle</span>
                  </label>
                  {form.recurrenceChoice === "auto-record-next-cycle" && !autoRecordAllowed ? (
                    <p className="field-help">Auto-record needs a complete fixed-amount record.</p>
                  ) : null}
                </fieldset>
              ) : null}
              {formError ? <p className="form-error full-span" role="alert">{formError}</p> : null}
              {savedMessage ? <p className="form-success full-span" aria-live="polite">{savedMessage}</p> : null}
              {hasSelectedAccount ? (
                <>
                  {showCancelChoices ? (
                    <dialog className="cancel-choice full-span" aria-label="Cancel entry" open>
                      <strong>What should happen to this entry?</strong>
                      <div className="quick-account-actions">
                        <button className="danger-action" type="button" onClick={resetEntry}>Discard changes</button>
                        <button className="secondary-action" type="button" onClick={keepEntryAsDraft}>Keep as draft</button>
                        <button className="quiet-action" type="button" onClick={() => setShowCancelChoices(false)}>Continue editing</button>
                      </div>
                    </dialog>
                  ) : null}
                  <div className="quick-account-actions full-span">
                    <button className="quiet-action" type="button" onClick={() => hasUnsavedChanges ? setShowCancelChoices(true) : resetEntry()}>Cancel entry</button>
                    <button className="primary-action" type="submit">Save record</button>
                  </div>
                </>
              ) : null}
            </form>
  );
}

function ManualLedgerPanel(props: Readonly<ManualLedgerFormProps>) {
  const { accounts, beginQuickAccountSetup, quickAccountField, quickAccountProps } = props;
  return (
    <Panel key="manual-ledger" title="Manual ledger record" eyebrow="Official local record">
      {accounts.length === 0 ? (
        <section className="manual-empty-state" aria-label="Account required" aria-live="polite">
          <span className="eyebrow">Account required</span>
          <h3>Create your first account</h3>
          <p>Your ledger needs a wallet, bank account, card, or other balance source before a record can be saved.</p>
          <button className="primary-action align-start" type="button" onClick={() => beginQuickAccountSetup("account")}>Create first account</button>
        </section>
      ) : (
        <ManualLedgerForm {...props} />
      )}
      {accounts.length === 0 && quickAccountField === "account" ? (
        <QuickAccountSetup {...quickAccountProps} />
      ) : null}
    </Panel>
  );
}


function CapturePage({
  records,
  accounts,
  navigate,
  draftToEdit,
  onDiscardDraft,
  onFinishDraftEdit,
  onAddAccount,
  onSaveInitialFunding,
  onSaveRecord,
  onSaveDraft,
  onSaveMeal,
  scans,
  onSaveScans,
  onUpdateScan,
  uploadQueue,
  onQueueUploads,
}: Readonly<{
  records: LocalLedgerRecord[];
  accounts: LocalAccount[];
  navigate: (item: NavItem) => void;
  draftToEdit: TransactionDraft | null;
  onDiscardDraft: (id: string) => void;
  onFinishDraftEdit: () => void;
  onAddAccount: (account: LocalAccount) => void;
  onSaveInitialFunding: (account: LocalAccount, draft: TransactionDraft) => boolean;
  onSaveRecord: (draft: TransactionDraft) => boolean;
  onSaveDraft: (draft: TransactionDraft) => void;
  onSaveMeal: (meal: MealEntry) => void;
  scans: TemporaryScan[];
  onSaveScans: (scans: TemporaryScan[]) => void;
  onUpdateScan: (scan: TemporaryScan) => void;
  uploadQueue: UploadQueueItem[];
  onQueueUploads: (items: UploadQueueItem[]) => void;
}>) {
  const initialForm: DraftForm = draftToEdit ? { ...draftToEdit } : createEmptyDraftForm();
  const [form, setForm] = useState<DraftForm>(initialForm);
  const [cleanForm, setCleanForm] = useState<DraftForm>(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [showCancelChoices, setShowCancelChoices] = useState(false);
  const [quickAccountField, setQuickAccountField] = useState<QuickAccountField | null>(null);
  const [quickAccountName, setQuickAccountName] = useState("");
  const [quickAccountCurrency, setQuickAccountCurrency] = useState("TWD");
  const [quickAccountType, setQuickAccountType] = useState("cash");
  const [quickAccountAllowNegative, setQuickAccountAllowNegative] = useState(true);
  const [quickAccountBalance, setQuickAccountBalance] = useState("");
  const [quickAccountBalanceDate, setQuickAccountBalanceDate] = useState(localDate());
  const [quickAccountError, setQuickAccountError] = useState("");
  const [customCategories, setCustomCategories] = useState<string[]>(readStoredCategories);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [quickCategoryName, setQuickCategoryName] = useState("");
  const [quickCategoryError, setQuickCategoryError] = useState("");
  const [customSources, setCustomSources] = useState<string[]>(readStoredSources);
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [quickSourceName, setQuickSourceName] = useState("");
  const [quickSourceError, setQuickSourceError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [captureIntent, setCaptureIntent] = useState<CaptureIntent>("manual-ledger");
  const {
    mealOccurredAt,
    setMealOccurredAt,
    mealNote,
    setMealNote,
    mealPhotoFiles,
    mealError,
    setMealError,
    mealSavedMessage,
    isCameraOpen,
    cameraError,
    cameraVideoRef,
    appendMealPhotos,
    stopCamera,
    openCamera,
    captureCameraPhoto,
    handleMealSubmit,
  } = useMealCapture(onSaveMeal, onQueueUploads);
  const {
    scanFiles,
    setScanFiles,
    scanError,
    setScanError,
    scanSavedMessage,
    handleScanSubmit,
  } = useScanCapture(captureIntent, onSaveScans, onQueueUploads);
  const hasUnsavedChanges = JSON.stringify(form) !== JSON.stringify(cleanForm);

  useEffect(() => {
    try {
      window.localStorage.setItem(categoriesStorageKey, JSON.stringify(customCategories));
    } catch {
      // Category persistence is best effort while the account and record stores remain local-first.
    }
  }, [customCategories]);

  useEffect(() => {
    try {
      window.localStorage.setItem(sourcesStorageKey, JSON.stringify(customSources));
    } catch {
      // Source persistence is best effort while the account and record stores remain local-first.
    }
  }, [customSources]);

  const recordCount = records.length;
  const actionIcons = {
    "manual-ledger": Banknote,
    "scan-invoice": ReceiptText,
    "scan-receipt": ReceiptText,
    "record-meal": ImagePlus,
    "attach-photo": Upload,
  } satisfies Record<CaptureIntent, LucideIcon>;
  const selectedCaptureAction = captureIntents.find((action) => action.id === captureIntent) ?? captureIntents[0];

  const updateForm = (field: keyof DraftForm, value: string) => {
    setFormError(null);
    setSavedMessage("");
    setForm((current) => ({ ...current, [field]: value }));
  };

  const isTransfer = form.kind === "transfer";
  const needsCategory = form.kind === "expense" || form.kind === "income" || form.kind === "refund";
  const counterpartyLabel = counterpartyLabelForKind(form.kind);
  const needsCounterparty = form.kind === "expense" || form.kind === "income" || form.kind === "refund" || form.kind === "fund-addition";
  const isUnresolvedExpense = form.kind === "unresolved-expense";
  const hasSelectedAccount = accounts.some((account) => account.name === form.account);
  const categoryOptions = (form.kind === "income" ? incomeCategories : expenseCategories).concat(customCategories);
  const sourceOptions = useMemo(
    () => [...new Set([...customSources, ...records.filter((record) => record.kind === "income" || record.kind === "fund-addition").map((record) => record.counterparty).filter(Boolean)])],
    [customSources, records],
  );
  const refundableRecords = records.filter((record) => record.kind === "expense" && record.recordState !== "voided");
  const merchantSuggestions = form.counterparty.trim()
    ? records.filter((record) => record.recordState !== "voided" && record.counterparty.toLocaleLowerCase().includes(form.counterparty.trim().toLocaleLowerCase())).slice(0, 5)
    : [];
  const itemSuggestions = form.itemName.trim()
    ? records.filter((record) => record.recordState !== "voided" && record.itemName?.toLocaleLowerCase().includes(form.itemName.trim().toLocaleLowerCase())).slice(0, 5)
    : [];
  const selectedRefundIds = selectedRefundIdsFor(form);
  const selectedRefundRecords = refundableRecords.filter((record) => selectedRefundIds.includes(record.id));
  const selectedRefundHasDifferentCurrency = selectedRefundRecords.some((record) => record.currency !== form.currency);
  const linkedRefundAmount = selectedRefundRecords
    .filter((record) => record.currency === form.currency)
    .reduce((total, record) => total + Number(record.amount), 0);
  const refundDifferenceNeedsClassification = Boolean(
    form.kind === "refund"
      && form.refundSubtype === "payback"
      && selectedRefundRecords.length > 0
      && (selectedRefundHasDifferentCurrency || Number(form.amount) > linkedRefundAmount),
  );
  const refundDifferenceLabel = selectedRefundHasDifferentCurrency ? "Currency difference handling" : "Excess amount handling";
  const supportsRecurrence = form.kind === "expense" || form.kind === "income" || form.kind === "transfer";
  const autoRecordAllowed = canAutoRecordNextCycle(form, accounts);

  const selectSourceAccount = (name: string) => {
    const account = accounts.find((item) => item.name === name);
    setForm((current) => {
      const currentDestination = accounts.find((item) => item.name === current.transferAccount);
      const shouldClearDestination = current.transferMode === "same-currency"
        && Boolean(account && currentDestination && account.currency !== currentDestination.currency);

      return {
        ...current,
        account: name,
        currency: account?.currency ?? current.currency,
        transferAccount: shouldClearDestination ? "" : current.transferAccount,
      };
    });
  };

  const selectDestinationAccount = (name: string) => {
    const account = accounts.find((item) => item.name === name);
    setForm((current) => ({
      ...current,
      transferAccount: name,
      destinationCurrency: account?.currency ?? current.destinationCurrency,
    }));
  };

  const selectFeeAccount = (name: string) => {
    const account = accounts.find((item) => item.name === name);
    setForm((current) => ({ ...current, feeAccount: name, feeCurrency: account?.currency ?? current.feeCurrency }));
  };

  const setTransferMode = (transferMode: DraftForm["transferMode"]) => {
    setForm((current) => {
      const sourceAccount = accounts.find((account) => account.name === current.account);
      const destinationAccount = accounts.find((account) => account.name === current.transferAccount);
      const shouldClearDestination = transferMode === "same-currency"
        && Boolean(sourceAccount && destinationAccount && sourceAccount.currency !== destinationAccount.currency);

      return {
        ...current,
        transferMode,
        transferAccount: shouldClearDestination ? "" : current.transferAccount,
      };
    });
  };

  const beginQuickAccountSetup = (field: QuickAccountField) => {
    setQuickAccountField(field);
    setQuickAccountName("");
    setQuickAccountType("cash");
    setQuickAccountAllowNegative(true);
    setQuickAccountBalance("");
    setQuickAccountBalanceDate(localDate());
    setQuickAccountError("");
  };

  const setRecordKind = (kind: DraftForm["kind"]) => {
    setForm((current) => ({ ...current, kind, category: "" }));
    setIsAddingCategory(false);
  };

  const addQuickCategory = () => {
    const category = quickCategoryName.trim();

    if (!category) {
      setQuickCategoryError("Enter a category name before adding it.");
      return;
    }

    if (categoryOptions.some((item) => item.toLocaleLowerCase() === category.toLocaleLowerCase())) {
      setQuickCategoryError("This category already exists.");
      return;
    }

    setCustomCategories((current) => [...current, category]);
    setForm((current) => ({ ...current, category }));
    setQuickCategoryName("");
    setQuickCategoryError("");
    setIsAddingCategory(false);
  };

  const addQuickSource = () => {
    const source = quickSourceName.trim();

    if (!source) {
      setQuickSourceError("Enter a source before adding it.");
      return;
    }

    if (sourceOptions.some((item) => item.toLocaleLowerCase() === source.toLocaleLowerCase())) {
      setQuickSourceError("This source already exists.");
      return;
    }

    setCustomSources((current) => [...current, source]);
    setForm((current) => ({ ...current, counterparty: source }));
    setQuickSourceName("");
    setQuickSourceError("");
    setIsAddingSource(false);
  };

  const applySuggestion = (field: "counterparty" | "itemName" | "amount" | "account" | "category" | "currency", value: string) => {
    if (field === "account") {
      selectSourceAccount(value);
      return;
    }

    updateForm(field, value);
  };

  const setMissingExpenseField = (field: "counterparty" | "itemName", missing: boolean) => {
    setFormError(null);
    setSavedMessage("");
    setForm((current) => ({
      ...current,
      ...missingExpenseFieldPatch(field, missing),
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const nextDraft = createTransactionDraft(form, draftId(), accounts);

    if (!nextDraft) {
      setFormError("Please fill in all required fields before saving this record.");
      return;
    }

    if (refundDifferenceNeedsClassification && form.refundExcessHandling === "unclassified") {
      setFormError("Classify the amount above the linked expense before saving this payback.");
      return;
    }

    if (!onSaveRecord(nextDraft)) {
      setFormError("This record could not be saved. Check the selected accounts and amounts.");
      return;
    }

    const nextCleanForm: DraftForm = {
      ...form,
      counterparty: "",
      counterpartyMissing: false,
      itemName: "",
      itemNameMissing: false,
      transferAccount: "",
      amount: "",
      destinationAmount: "",
      feeEnabled: false,
      feeAccount: "",
      feeAmount: "",
      feeCategory: "",
      refundReason: "",
      refundSubtype: "refund",
      refundLinkedRecordId: "",
      refundLinkedRecordIds: [],
      refundExcessHandling: "unclassified",
      recurrenceChoice: "current-cycle-only",
      recurrenceAmountMode: "fixed",
      reason: "",
      periodStart: "",
      periodEnd: "",
    };
    setSavedMessage("Record saved to the local ledger.");
    setForm(nextCleanForm);
    setCleanForm(nextCleanForm);
    if (draftToEdit) {
      onDiscardDraft(draftToEdit.id);
      onFinishDraftEdit();
    }
    setShowCancelChoices(false);
  };

  const resetEntry = () => {
    const nextForm = createEmptyDraftForm();
    setForm(nextForm);
    setCleanForm(nextForm);
    setFormError(null);
    setSavedMessage("Entry cancelled.");
    setShowCancelChoices(false);
  };

  const keepEntryAsDraft = () => {
    onSaveDraft({ ...normalizeDraftForm(form), id: draftId() });
    resetEntry();
  };

  const addQuickAccount = () => {
    if (!quickAccountField) {
      return;
    }

    const account = createLocalAccount(quickAccountName, quickAccountCurrency, crypto.randomUUID(), quickAccountType, quickAccountAllowNegative);

    if (!account) {
      setQuickAccountError("Enter an account name before adding it.");
      return;
    }

    if (accounts.some((item) => item.name.toLocaleLowerCase() === account.name.toLocaleLowerCase())) {
      setQuickAccountError("An account with this name already exists.");
      return;
    }

    if (quickAccountBalance.trim()) {
      const draft = createInitialFundingDraft({
        account: account.name,
        amount: quickAccountBalance,
        currency: account.currency,
        date: quickAccountBalanceDate,
      }, `fund-${account.id}`);

      if (!draft || !onSaveInitialFunding(account, draft)) {
        setQuickAccountError("Enter a positive initial balance and a valid date.");
        return;
      }
    }

    onAddAccount(account);
    if (quickAccountField === "account") {
      setForm((current) => ({ ...current, account: account.name, currency: account.currency }));
    } else if (quickAccountField === "transferAccount") {
      setForm((current) => ({ ...current, transferAccount: account.name, destinationCurrency: account.currency }));
    } else {
      setForm((current) => ({ ...current, feeAccount: account.name, feeCurrency: account.currency }));
    }
    setQuickAccountField(null);
    setQuickAccountName("");
    setQuickAccountType("cash");
    setQuickAccountAllowNegative(true);
    setQuickAccountBalance("");
    setQuickAccountBalanceDate(localDate());
    setQuickAccountError("");
  };

  const setTimePrecision = (timePrecision: DraftForm["timePrecision"]) => {
    setForm((current) => ({
      ...current,
      timePrecision,
      date: timePrecision === "day" ? current.date : "",
      periodStart: timePrecision === "day" ? "" : current.periodStart,
      periodEnd: timePrecision === "day" ? "" : current.periodEnd,
    }));
  };

  const setMonthRange = (month: string) => {
    const range = monthToPeriodRange(month);
    if (!range) {
      setForm((current) => ({ ...current, periodStart: "", periodEnd: "" }));
      return;
    }

    setForm((current) => ({
      ...current,
      ...range,
    }));
  };

  const quickAccountProps: React.ComponentProps<typeof QuickAccountSetup> = {
    accountName: quickAccountName,
    currency: quickAccountCurrency,
    accountType: quickAccountType,
    allowNegativeBalance: quickAccountAllowNegative,
    initialBalance: quickAccountBalance,
    initialBalanceDate: quickAccountBalanceDate,
    error: quickAccountError,
    onAccountNameChange: (value) => { setQuickAccountName(value); setQuickAccountError(""); },
    onCurrencyChange: setQuickAccountCurrency,
    onAccountTypeChange: setQuickAccountType,
    onAllowNegativeBalanceChange: setQuickAccountAllowNegative,
    onInitialBalanceChange: (value) => { setQuickAccountBalance(value); setQuickAccountError(""); },
    onInitialBalanceDateChange: (value) => { setQuickAccountBalanceDate(value); setQuickAccountError(""); },
    onConfirm: addQuickAccount,
    onCancel: () => { setQuickAccountField(null); setQuickAccountBalance(""); setQuickAccountBalanceDate(localDate()); setQuickAccountError(""); },
  };

  const manualLedgerProps: ManualLedgerFormProps = {
    form,
    accounts,
    hasSelectedAccount,
    isUnresolvedExpense,
    isTransfer,
    needsCategory,
    categoryOptions,
    needsCounterparty,
    counterpartyLabel,
    sourceOptions,
    refundableRecords,
    selectedRefundIds,
    selectedRefundHasDifferentCurrency,
    refundDifferenceNeedsClassification,
    refundDifferenceLabel,
    merchantSuggestions,
    itemSuggestions,
    supportsRecurrence,
    autoRecordAllowed,
    hasUnsavedChanges,
    showCancelChoices,
    formError,
    savedMessage,
    quickAccountField,
    quickAccountProps,
    isAddingCategory,
    quickCategoryName,
    quickCategoryError,
    isAddingSource,
    quickSourceName,
    quickSourceError,
    setForm,
    setFormError,
    setSavedMessage,
    updateForm,
    handleSubmit,
    beginQuickAccountSetup,
    setTimePrecision,
    setMonthRange,
    selectSourceAccount,
    selectDestinationAccount,
    selectFeeAccount,
    setTransferMode,
    setRecordKind,
    setMissingExpenseField,
    applySuggestion,
    setIsAddingCategory,
    setQuickCategoryName,
    setQuickCategoryError,
    addQuickCategory,
    setIsAddingSource,
    setQuickSourceName,
    setQuickSourceError,
    addQuickSource,
    resetEntry,
    keepEntryAsDraft,
    setShowCancelChoices,
  };

  return (
    <section className="capture-layout">
      <CaptureStartPanel
        captureIntent={captureIntent}
        selectedCaptureAction={selectedCaptureAction}
        actionIcons={actionIcons}
        onSelectIntent={setCaptureIntent}
      />
      <CaptureIntentPanel
        captureIntent={captureIntent}
        manualLedgerProps={manualLedgerProps}
        mealProps={{
          mealOccurredAt,
          mealNote,
          mealPhotoFiles,
          mealError,
          mealSavedMessage,
          isCameraOpen,
          cameraError,
          cameraVideoRef,
          uploadQueue,
          onMealTimeChange: (value) => { setMealOccurredAt(value); setMealError(""); },
          onMealNoteChange: setMealNote,
          onAppendPhotos: appendMealPhotos,
          onOpenCamera: openCamera,
          onCapturePhoto: captureCameraPhoto,
          onStopCamera: stopCamera,
          onSubmit: handleMealSubmit,
        }}
        scanProps={{
          captureIntent: captureIntent === "scan-invoice" || captureIntent === "scan-receipt" ? captureIntent : "scan-receipt",
          scanFiles,
          scanError,
          scanSavedMessage,
          scans,
          uploadQueue,
          onScanFilesChange: (files) => { setScanFiles(files); setScanError(""); },
          onSubmit: handleScanSubmit,
          onUpdateScan,
        }}
      />
      <SavedRecordPanel recordCount={recordCount} navigate={navigate} />
    </section>
  );
}

type CaptureIntentPanelProps = {
  captureIntent: CaptureIntent;
  manualLedgerProps: React.ComponentProps<typeof ManualLedgerPanel>;
  mealProps: React.ComponentProps<typeof MealCapturePanel>;
  scanProps: React.ComponentProps<typeof ScanCapturePanel>;
};

function CaptureIntentPanel({ captureIntent, manualLedgerProps, mealProps, scanProps }: Readonly<CaptureIntentPanelProps>) {
  if (captureIntent === "manual-ledger") {
    return <ManualLedgerPanel {...manualLedgerProps} />;
  }
  if (captureIntent === "record-meal") {
    return <MealCapturePanel {...mealProps} />;
  }
  if (captureIntent === "scan-invoice" || captureIntent === "scan-receipt") {
    return <ScanCapturePanel {...scanProps} />;
  }
  return <CaptureWorkspacePanel captureIntent={captureIntent} />;
}

function MealCaptureForm({
  mealOccurredAt,
  mealNote,
  mealPhotoFiles,
  mealError,
  mealSavedMessage,
  isCameraOpen,
  cameraError,
  cameraVideoRef,
  uploadQueue,
  onMealTimeChange,
  onMealNoteChange,
  onAppendPhotos,
  onOpenCamera,
  onCapturePhoto,
  onStopCamera,
  onSubmit,
}: Readonly<{
  mealOccurredAt: string;
  mealNote: string;
  mealPhotoFiles: File[];
  mealError: string;
  mealSavedMessage: string;
  isCameraOpen: boolean;
  cameraError: string;
  cameraVideoRef: React.RefObject<HTMLVideoElement>;
  uploadQueue: UploadQueueItem[];
  onMealTimeChange: (value: string) => void;
  onMealNoteChange: (value: string) => void;
   onAppendPhotos: (files: PhotoInput) => void;
  onOpenCamera: () => Promise<void>;
  onCapturePhoto: () => void;
  onStopCamera: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}>) {
  return (
    <form className="meal-form" onSubmit={onSubmit}>
      <label>
        <span>Meal time</span>
        <input required type="datetime-local" value={mealOccurredAt} onChange={(event) => onMealTimeChange(event.target.value)} />
      </label>
      <label>
        <span>Meal note</span>
        <textarea value={mealNote} onChange={(event) => onMealNoteChange(event.target.value)} placeholder="Optional" />
      </label>
      <MealPhotoPicker onOpenCamera={onOpenCamera} onAppendPhotos={onAppendPhotos} />
      {isCameraOpen ? <MealCameraDialog cameraVideoRef={cameraVideoRef} onCapturePhoto={onCapturePhoto} onStopCamera={onStopCamera} /> : null}
      {cameraError ? <p className="quick-account-error" role="alert">{cameraError}</p> : null}
      {mealPhotoFiles.length > 0 ? <p className="field-help">{countLabel(mealPhotoFiles.length, "photo")} ready for this meal. You can add more before saving.</p> : null}
      <button className="primary-action align-start" type="submit">Save meal</button>
      {mealError ? <p className="quick-account-error" role="alert">{mealError}</p> : null}
      {mealSavedMessage ? <p className="auth-message" aria-live="polite">{mealSavedMessage}</p> : null}
      {uploadQueue.length > 0 ? <p className="field-help">{countLabel(uploadQueue.length, "media file")} queued locally for a future upload.</p> : null}
    </form>
  );
}

function MealPhotoPicker({ onOpenCamera, onAppendPhotos }: Readonly<{ onOpenCamera: () => Promise<void>; onAppendPhotos: (files: PhotoInput) => void }>) {
  return (
    <div className="meal-photo-picker">
      <span className="meal-field-label">Meal photos</span>
      <div className="meal-photo-actions">
        <button className="meal-file-action" type="button" onClick={() => { onOpenCamera().catch(() => undefined); }}><Camera size={18} aria-hidden="true" /><span>Take photo</span></button>
        <label className="meal-file-action" htmlFor="meal-photos"><ImagePlus size={18} aria-hidden="true" /><span>Choose photos</span><input id="meal-photos" aria-label="Meal photos" accept="image/*" multiple type="file" onChange={(event) => onAppendPhotos(event.target.files)} /></label>
      </div>
    </div>
  );
}

function MealCameraDialog({ cameraVideoRef, onCapturePhoto, onStopCamera }: Readonly<{ cameraVideoRef: React.RefObject<HTMLVideoElement>; onCapturePhoto: () => void; onStopCamera: () => void }>) {
  return (
    <dialog className="camera-capture-dialog" aria-label="Take meal photo" open>
      <video className="camera-preview" ref={cameraVideoRef} autoPlay playsInline muted aria-label="Camera preview" />
      <div className="camera-capture-actions"><button className="primary-action" type="button" onClick={onCapturePhoto}>Capture photo</button><button className="secondary-action" type="button" onClick={onStopCamera}>Cancel</button></div>
    </dialog>
  );
}

function MealCapturePanel(props: Readonly<React.ComponentProps<typeof MealCaptureForm>>) {
  return (
    <Panel key="record-meal" title="Record meal" eyebrow="Optional meal record">
      <p className="panel-copy">A meal can stand alone, have multiple photos, and be linked to a ledger record later.</p>
      <MealCaptureForm {...props} />
    </Panel>
  );
}

function TransferFields({
  form,
  accounts,
  quickAccountField,
  quickAccountProps,
  onBeginQuickAccountSetup,
  onSelectDestinationAccount,
  onSetTransferMode,
}: Readonly<{
  form: DraftForm;
  accounts: LocalAccount[];
  quickAccountField: QuickAccountField | null;
  quickAccountProps: React.ComponentProps<typeof QuickAccountSetup>;
  onBeginQuickAccountSetup: (field: QuickAccountField) => void;
  onSelectDestinationAccount: (name: string) => void;
  onSetTransferMode: (mode: DraftForm["transferMode"]) => void;
}>) {
  return (
    <>
      <TransferModeField transferMode={form.transferMode} onSetTransferMode={onSetTransferMode} />
      <TransferDestinationField form={form} accounts={accounts} quickAccountField={quickAccountField} quickAccountProps={quickAccountProps} onBeginQuickAccountSetup={onBeginQuickAccountSetup} onSelectDestinationAccount={onSelectDestinationAccount} />
    </>
  );
}

function TransferModeField({ transferMode, onSetTransferMode }: Readonly<{ transferMode: DraftForm["transferMode"]; onSetTransferMode: (mode: DraftForm["transferMode"]) => void }>) {
  return <section className="transfer-mode full-span" aria-label="Transfer type"><fieldset className="segmented-fieldset"><legend>Transfer type</legend><div className="segmented-control">{(["same-currency", "cross-currency"] as const).map((mode) => <label className={transferMode === mode ? "active" : ""} key={mode}><input checked={transferMode === mode} name="transfer-mode" type="radio" value={mode} onChange={() => onSetTransferMode(mode)} /><span>{mode === "same-currency" ? "Same currency" : "Cross currency"}</span></label>)}</div></fieldset></section>;
}

function TransferDestinationField({ form, accounts, quickAccountField, quickAccountProps, onBeginQuickAccountSetup, onSelectDestinationAccount }: Readonly<{ form: DraftForm; accounts: LocalAccount[]; quickAccountField: QuickAccountField | null; quickAccountProps: React.ComponentProps<typeof QuickAccountSetup>; onBeginQuickAccountSetup: (field: QuickAccountField) => void; onSelectDestinationAccount: (name: string) => void }>) {
  return <div className="form-field"><label htmlFor="entry-destination-account"><span>Destination account</span></label><div className="field-control-row"><select id="entry-destination-account" required disabled={accounts.length < 2} value={form.transferAccount} onChange={(event) => onSelectDestinationAccount(event.target.value)}><option value="">{accounts.length < 2 ? "Add another account" : "Select destination account"}</option>{accounts.filter((account) => account.name !== form.account && (form.transferMode !== "same-currency" || account.currency === form.currency)).map((account) => <option key={account.id} value={account.name}>{account.name} ({account.currency})</option>)}</select><button className="icon-button" type="button" aria-label="Add destination account" title="Add destination account" onClick={() => onBeginQuickAccountSetup("transferAccount")}><Plus size={18} aria-hidden="true" /></button></div>{quickAccountField === "transferAccount" ? <QuickAccountSetup {...quickAccountProps} /> : null}</div>;
}

function FeeFields({
  form,
  accounts,
  quickAccountField,
  quickAccountProps,
  onBeginQuickAccountSetup,
  onSelectFeeAccount,
  onUpdateForm,
}: Readonly<{
  form: DraftForm;
  accounts: LocalAccount[];
  quickAccountField: QuickAccountField | null;
  quickAccountProps: React.ComponentProps<typeof QuickAccountSetup>;
  onBeginQuickAccountSetup: (field: QuickAccountField) => void;
  onSelectFeeAccount: (name: string) => void;
  onUpdateForm: (field: keyof DraftForm, value: string) => void;
}>) {
  return (
    <>
      <FeeAccountField form={form} accounts={accounts} quickAccountField={quickAccountField} quickAccountProps={quickAccountProps} onBeginQuickAccountSetup={onBeginQuickAccountSetup} onSelectFeeAccount={onSelectFeeAccount} />
      <AmountField id="entry-fee-amount" label="Fee amount" value={form.feeAmount} onChange={(value) => onUpdateForm("feeAmount", value)} />
      <div className="form-field"><span>Fee currency</span><output className="derived-value">{form.feeCurrency}</output></div>
      <label><span>Fee category</span><input value={form.feeCategory} onChange={(event) => onUpdateForm("feeCategory", event.target.value)} placeholder="Fees" /></label>
    </>
  );
}

function FeeAccountField({ form, accounts, quickAccountField, quickAccountProps, onBeginQuickAccountSetup, onSelectFeeAccount }: Readonly<{ form: DraftForm; accounts: LocalAccount[]; quickAccountField: QuickAccountField | null; quickAccountProps: React.ComponentProps<typeof QuickAccountSetup>; onBeginQuickAccountSetup: (field: QuickAccountField) => void; onSelectFeeAccount: (name: string) => void }>) {
  return <div className="form-field"><label htmlFor="entry-fee-account"><span>Fee account</span></label><div className="field-control-row"><select id="entry-fee-account" value={form.feeAccount} onChange={(event) => onSelectFeeAccount(event.target.value)}><option value="">Select fee account</option>{accounts.map((account) => <option key={account.id} value={account.name}>{account.name} ({account.currency})</option>)}</select><button className="icon-button" type="button" aria-label="Add fee account" title="Add fee account" onClick={() => onBeginQuickAccountSetup("feeAccount")}><Plus size={18} aria-hidden="true" /></button></div>{quickAccountField === "feeAccount" ? <QuickAccountSetup {...quickAccountProps} /> : null}</div>;
}

function ScanCapturePanel({
  captureIntent,
  scanFiles,
  scanError,
  scanSavedMessage,
  scans,
  uploadQueue,
  onScanFilesChange,
  onSubmit,
  onUpdateScan,
}: Readonly<{
  captureIntent: "scan-invoice" | "scan-receipt";
  scanFiles: File[];
  scanError: string;
  scanSavedMessage: string;
  scans: TemporaryScan[];
  uploadQueue: UploadQueueItem[];
  onScanFilesChange: (files: File[]) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateScan: (scan: TemporaryScan) => void;
}>) {
  return (
    <Panel key={captureIntent} title={captureIntentLabel(captureIntent)} eyebrow="Temporary source">
      <p className="panel-copy">Scans remain temporary until you explicitly keep or discard them. They do not create official ledger records.</p>
      <form className="meal-form" onSubmit={onSubmit}>
        <label>
          <span>Scan images</span>
          <input accept="image/*" multiple type="file" onChange={(event) => onScanFilesChange(Array.from(event.target.files ?? []))} />
        </label>
        {scanFiles.length > 0 ? <p className="field-help">Selected {countLabel(scanFiles.length, "image")}.</p> : null}
        <button className="primary-action align-start" type="submit">Save scan drafts</button>
        {scanError ? <p className="quick-account-error" role="alert">{scanError}</p> : null}
        {scanSavedMessage ? <p className="auth-message" aria-live="polite">{scanSavedMessage}</p> : null}
        {uploadQueue.length > 0 ? <p className="field-help">{countLabel(uploadQueue.length, "media file")} queued locally for a future upload.</p> : null}
      </form>
      <div className="source-list" aria-label="Temporary scans">
        {scans.filter((scan) => scan.intent === captureIntent && ["temporary", "retained"].includes(scan.state)).map((scan) => (
          <div className="source-list-row" key={scan.id}>
            <span><strong>{scan.fileName}</strong><small>{scan.state === "temporary" ? "Temporary · expires in 24 hours" : "Retained source"}</small></span>
            {scan.state === "temporary" ? (
              <span className="source-list-actions">
                <button className="quiet-action" type="button" onClick={() => onUpdateScan(retainTemporaryScan(scan))}>Keep source</button>
                <button className="quiet-action" type="button" onClick={() => onUpdateScan(discardTemporaryScan(scan))}>Discard</button>
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function CaptureWorkspacePanel({ captureIntent }: Readonly<{ captureIntent: CaptureIntent }>) {
  return (
    <Panel key="capture-workspace" title={captureIntentLabel(captureIntent)} eyebrow="Capture workspace">
      <p className="panel-copy">This source is kept separate from the official ledger. The workflow will ask for confirmation before any ledger record is created.</p>
      <p className="field-help">Select Manual ledger when you want to record an official transaction now.</p>
    </Panel>
  );
}

function SavedRecordPanel({ recordCount, navigate }: Readonly<{ recordCount: number; navigate: (item: NavItem) => void }>) {
  if (recordCount === 0) return null;
  return (
    <Panel title="Record saved" eyebrow="Local ledger">
      <p className="panel-copy">{countLabel(recordCount, "official local record")} stored on this device.</p>
      <button className="secondary-action align-start" type="button" onClick={() => navigate(navItemFor("ledger"))}>
        Open Ledger
      </button>
    </Panel>
  );
}

type AccountSetupPanelProps = {
  accounts: LocalAccount[];
  accountName: string;
  accountCurrency: string;
  accountType: string;
  allowNegativeBalance: boolean;
  balanceMode: "zero" | "current";
  balance: string;
  balanceDate: string;
  accountError: string;
  onAccountNameChange: (value: string) => void;
  onAccountCurrencyChange: (value: string) => void;
  onAccountTypeChange: (value: string) => void;
  onAllowNegativeBalanceChange: (value: boolean) => void;
  onBalanceModeChange: (value: "zero" | "current") => void;
  onBalanceChange: (value: string) => void;
  onBalanceDateChange: (value: string) => void;
  onReopenOnboarding: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

type AccountSetupFormProps = Omit<AccountSetupPanelProps, "accounts" | "onReopenOnboarding">;

function AccountSetupForm({
  accountName, accountCurrency, accountType, allowNegativeBalance, balanceMode, balance, balanceDate, accountError,
  onAccountNameChange, onAccountCurrencyChange, onAccountTypeChange, onAllowNegativeBalanceChange, onBalanceModeChange,
  onBalanceChange, onBalanceDateChange, onSubmit,
}: Readonly<AccountSetupFormProps>) {
  return (
    <form className="draft-form" noValidate onSubmit={onSubmit}>
      <label><span>Account name</span><input required pattern=".*\S.*" value={accountName} onChange={(event) => onAccountNameChange(event.target.value)} placeholder="Daily wallet" /></label>
      <label><span>Currency</span><select value={accountCurrency} onChange={(event) => onAccountCurrencyChange(event.target.value)}><option value="TWD">TWD</option><option value="JPY">JPY</option><option value="USD">USD</option></select></label>
      <label><span>Account type</span><select value={accountType} onChange={(event) => onAccountTypeChange(event.target.value)}><option value="cash">Cash</option><option value="bank">Bank account</option><option value="card">Credit card</option><option value="wallet">Stored-value wallet</option><option value="other">Other</option></select></label>
      <label className="checkbox-row"><input type="checkbox" checked={allowNegativeBalance} onChange={(event) => onAllowNegativeBalanceChange(event.target.checked)} /><span>Allow negative balance</span></label>
      <fieldset>
        <legend>Starting balance</legend>
        <label className="radio-row"><input type="radio" checked={balanceMode === "zero"} onChange={() => onBalanceModeChange("zero")} /> <span>Start from zero</span></label>
        <label className="radio-row"><input type="radio" checked={balanceMode === "current"} onChange={() => onBalanceModeChange("current")} /> <span>Enter current balance</span></label>
      </fieldset>
      {balanceMode === "current" ? <div className="onboarding-balance-fields"><AmountField id="settings-current-balance" label="Current balance" required value={balance} onChange={onBalanceChange} placeholder="0" /><label><span>As of date</span><input required type="date" value={balanceDate} onChange={(event) => onBalanceDateChange(event.target.value)} /></label></div> : null}
      <button className="primary-action align-start" type="submit">Add account</button>
      {accountError ? <p className="quick-account-error" role="alert">{accountError}</p> : null}
    </form>
  );
}

function AccountSetupPanel({
  accounts, accountName, accountCurrency, accountType, allowNegativeBalance, balanceMode, balance, balanceDate, accountError,
  onAccountNameChange, onAccountCurrencyChange, onAccountTypeChange, onAllowNegativeBalanceChange, onBalanceModeChange,
  onBalanceChange, onBalanceDateChange, onReopenOnboarding, onSubmit,
}: Readonly<AccountSetupPanelProps>) {
  return (
    <Panel title="Accounts" eyebrow="Local setup">
      <p className="panel-copy">Create the accounts that manual records may use. This preview keeps them only in the current workspace session.</p>
      <button className="quiet-action" type="button" onClick={onReopenOnboarding}>Reopen first-account setup</button>
      <AccountSetupForm
        accountName={accountName}
        accountCurrency={accountCurrency}
        accountType={accountType}
        allowNegativeBalance={allowNegativeBalance}
        balanceMode={balanceMode}
        balance={balance}
        balanceDate={balanceDate}
        accountError={accountError}
        onAccountNameChange={onAccountNameChange}
        onAccountCurrencyChange={onAccountCurrencyChange}
        onAccountTypeChange={onAccountTypeChange}
        onAllowNegativeBalanceChange={onAllowNegativeBalanceChange}
        onBalanceModeChange={onBalanceModeChange}
        onBalanceChange={onBalanceChange}
        onBalanceDateChange={onBalanceDateChange}
        onSubmit={onSubmit}
      />
      {accounts.length === 0 ? <p className="panel-copy">No accounts yet. Add one before creating a manual record.</p> : null}
      {accounts.length > 0 ? <ul className="account-list" aria-label="Available accounts">{accounts.map((account) => <li key={account.id}><strong>{account.name}</strong><span>{account.currency}</span></li>)}</ul> : null}
    </Panel>
  );
}

function SettingsPage({ accounts, records, onAddAccount, onSaveInitialFunding, onImportRecord, onMergeImportDraft, onReopenOnboarding, onSignOut }: Readonly<{
  accounts: LocalAccount[];
  records: LocalLedgerRecord[];
  onAddAccount: (account: LocalAccount) => void;
  onSaveInitialFunding: (account: LocalAccount, draft: TransactionDraft) => boolean;
  onImportRecord: (row: NormalizedImportRow, importId: string) => boolean;
  onMergeImportDraft: (row: NormalizedImportRow, importId: string) => boolean;
  onReopenOnboarding: () => void;
  onSignOut: () => Promise<void>;
}>) {
  const [accountName, setAccountName] = useState("");
  const [accountCurrency, setAccountCurrency] = useState("TWD");
  const [accountType, setAccountType] = useState("cash");
  const [allowNegativeBalance, setAllowNegativeBalance] = useState(false);
  const [balanceMode, setBalanceMode] = useState<"zero" | "current">("zero");
  const [balance, setBalance] = useState("");
  const [balanceDate, setBalanceDate] = useState(localDate());
  const [accountError, setAccountError] = useState("");
  const handleAccountSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAccountError("");
    const account = createLocalAccount(accountName, accountCurrency, draftId(), accountType, allowNegativeBalance);

    if (!account || accounts.some((item) => item.name.toLocaleLowerCase() === account.name.toLocaleLowerCase())) {
      setAccountError(account ? "An account with this name already exists." : "Enter an account name and currency.");
      return;
    }

    if (balanceMode === "current") {
      const draft = createInitialFundingDraft({ account: account.name, amount: balance, currency: account.currency, date: balanceDate }, `fund-${account.id}`);
      if (!draft || !onSaveInitialFunding(account, draft)) {
        setAccountError("Enter a positive current balance and a valid date.");
        return;
      }
    }

    onAddAccount(account);
    setAccountName("");
    setBalance("");
    setBalanceMode("zero");
  };

  return (
    <section className="content-grid">
      <AccountSetupPanel
        accounts={accounts}
        accountName={accountName}
        accountCurrency={accountCurrency}
        accountType={accountType}
        allowNegativeBalance={allowNegativeBalance}
        balanceMode={balanceMode}
        balance={balance}
        balanceDate={balanceDate}
        accountError={accountError}
        onAccountNameChange={setAccountName}
        onAccountCurrencyChange={setAccountCurrency}
        onAccountTypeChange={setAccountType}
        onAllowNegativeBalanceChange={setAllowNegativeBalance}
        onBalanceModeChange={setBalanceMode}
        onBalanceChange={setBalance}
        onBalanceDateChange={setBalanceDate}
        onReopenOnboarding={onReopenOnboarding}
        onSubmit={handleAccountSubmit}
      />
      <AccountSyncPanel onSignOut={onSignOut} />
      <ImportExportPanel accounts={accounts} records={records} onImportRecord={onImportRecord} onMergeImportDraft={onMergeImportDraft} />
    </section>
  );
}

function AccountSyncPanel({ onSignOut }: Readonly<{ onSignOut: () => Promise<void> }>) {
  return (
    <Panel title="Account and sync" eyebrow="Settings">
      <dl className="settings-list">
        <div>
          <dt>Authentication</dt>
          <dd>{isSupabaseConfigured ? "Cloud sign-in is ready" : "Cloud sign-in is unavailable in this workspace"}</dd>
        </div>
        <div>
          <dt>Storage</dt>
          <dd>Drafts, uploads, and photo evidence show whether they are backed up.</dd>
        </div>
      </dl>
      <button className="secondary-action align-start" type="button" onClick={() => { onSignOut().catch(() => undefined); }}>
        <LogOut size={18} aria-hidden="true" />
        Sign out
      </button>
    </Panel>
  );
}

function ImportExportPanel({ accounts, records, onImportRecord, onMergeImportDraft }: Readonly<{
  accounts: LocalAccount[];
  records: LocalLedgerRecord[];
  onImportRecord: (row: NormalizedImportRow, importId: string) => boolean;
  onMergeImportDraft: (row: NormalizedImportRow, importId: string) => boolean;
}>) {
  const [importMessage, setImportMessage] = useState("No CSV selected. Validation does not write to the ledger.");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [importItems, setImportItems] = useState<ImportReviewItem[]>([]);
  const [exportMessage, setExportMessage] = useState("");
  const [exportProgress, setExportProgress] = useState(0);
  const [exporting, setExporting] = useState(false);

  const handleCsvSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setSelectedFileName(file.name);

    const result = validateCsvBytes(new Uint8Array(await file.arrayBuffer()));
    if (!result.ok) {
      setImportMessage(`CSV rejected: ${result.errors.join(" ")}`);
      setImportItems([]);
      return;
    }

    const headerMapping = mapImportHeaders(result.headers);
    const mappedFields = Object.keys(headerMapping.mapping).join(", ");
    const unmapped = headerMapping.unmappedHeaders.length > 0 ? ` Unmapped: ${headerMapping.unmappedHeaders.join(", ")}.` : "";
    const conflicts = headerMapping.conflicts.length > 0 ? ` Conflicts: ${headerMapping.conflicts.join(" ")}` : "";
    const rowResults = validateImportRows(result.rows.map((row) => mapImportRow(result.headers, row, headerMapping)), accounts);
    const duplicateReviews = detectImportDuplicates(rowResults.map((row) => ({ rowNumber: row.rowNumber, normalized: row.normalized })), records);
    const aliasReviews = rowResults.flatMap((row) => {
      if (!(["expense", "income", "refund"] as string[]).includes(row.normalized.kind ?? "")) {
        return [];
      }
      const summary = categoryReviewSummary(row.normalized.category ?? "");
      return summary ? [{ rowNumber: row.rowNumber, summary }] : [];
    });
    const reviewRows = rowResults.filter((row) => !row.ok).map((row) => row.rowNumber);
    const reviewedRowNumbers = new Set([...reviewRows, ...aliasReviews.map((item) => item.rowNumber)]);
    duplicateReviews.forEach((_, rowNumber) => reviewedRowNumbers.add(rowNumber));
    const reviewCount = reviewedRowNumbers.size;
    const aliasMessage = formatAliasReviewMessage(aliasReviews);
    const duplicateMessage = formatDuplicateReviewMessage([...duplicateReviews.keys()]);
    setImportItems(rowResults.map((row) => ({
      ...row,
      reviewId: `import-row-${Date.now()}-${row.rowNumber}`,
      aliasReview: aliasReviews.find((item) => item.rowNumber === row.rowNumber)?.summary ?? null,
      duplicates: duplicateReviews.get(row.rowNumber) ?? [],
      status: "pending",
    })));
    setImportMessage(`CSV ready for review: ${result.rowCount} rows and ${result.headers.length} columns. Mapped: ${mappedFields || "none"}. Rows ready: ${result.rowCount - reviewCount}; review required: ${reviewCount}.${unmapped}${conflicts}${aliasMessage}${duplicateMessage} No records were created.`);
  };

  const confirmImport = (item: ImportReviewItem) => {
    if (!item.ok || item.aliasReview || item.duplicates.length > 0 || item.status !== "pending") {
      return;
    }

    const imported = onImportRecord(item.normalized, item.reviewId);
    setImportItems((current) => current.map((candidate) => candidate.reviewId === item.reviewId ? { ...candidate, status: importStatus("confirmed", imported) } : candidate));
    setImportMessage(imported ? `Imported row ${item.rowNumber} into the local ledger.` : `Row ${item.rowNumber} could not be imported and remains in review.`);
  };

  const keepSeparate = (item: ImportReviewItem) => {
    if (!item.ok || item.status !== "pending" || item.duplicates.length === 0) {
      return;
    }

    const imported = onImportRecord(item.normalized, item.reviewId);
    setImportItems((current) => current.map((candidate) => candidate.reviewId === item.reviewId ? { ...candidate, status: importStatus("kept-separate", imported) } : candidate));
    setImportMessage(imported ? `Kept row ${item.rowNumber} as a separate local ledger record.` : `Row ${item.rowNumber} could not be kept and remains in review.`);
  };

  const linkExisting = (item: ImportReviewItem) => {
    const candidate = item.duplicates[0];
    if (!candidate || item.status !== "pending") {
      return;
    }

    setImportItems((current) => current.map((reviewItem) => reviewItem.reviewId === item.reviewId ? { ...reviewItem, status: "linked" } : reviewItem));
    setImportMessage(`Linked row ${item.rowNumber} to ${duplicateCandidateName(candidate)} without changing the ledger.`);
  };

  const mergeIntoDraft = (item: ImportReviewItem) => {
    if (!item.ok || item.status !== "pending" || item.duplicates.length === 0) {
      return;
    }

    const merged = onMergeImportDraft(item.normalized, item.reviewId);
    setImportItems((current) => current.map((candidate) => candidate.reviewId === item.reviewId ? { ...candidate, status: importStatus("merged", merged) } : candidate));
    setImportMessage(merged ? `Moved row ${item.rowNumber} into local review drafts without changing the ledger.` : `Row ${item.rowNumber} could not become a draft and remains in review.`);
  };

  const skipImport = (item: ImportReviewItem) => {
    setImportItems((current) => current.map((candidate) => candidate.reviewId === item.reviewId ? { ...candidate, status: "skipped" } : candidate));
    setImportMessage(`Skipped row ${item.rowNumber}. It was not written to the ledger.`);
  };

  const exportZip = async () => {
    if (exporting) {
      return;
    }

    setExporting(true);
    setExportProgress(0);
    setExportMessage("Preparing ZIP export...");
    try {
      const bundle = await createMultiTableExportWithProgress(accounts, records, (percentage, stage) => {
        setExportProgress(percentage);
        setExportMessage(exportStageMessage(stage));
      });
      downloadBinaryFile(bundle.zip, "mealledger-export.zip", "application/zip");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Panel title="Import and export safeguards" eyebrow="Data portability">
      <p className="panel-copy">
        Clean exports include confirmed ledger records only. Attachments stay as metadata
        references, not image bytes, and CSV/JSON use the same stable field set.
      </p>
      <section className="portability-section" aria-labelledby="csv-import-heading">
        <h3 id="csv-import-heading">Import a CSV</h3>
        <div className="file-picker">
          <input id="csv-import-file" className="file-picker-input" aria-label="CSV import file" accept=".csv,text/csv" type="file" onChange={handleCsvSelection} />
          <label className="secondary-action file-picker-button" htmlFor="csv-import-file">Choose CSV file</label>
          <span className="file-picker-name" aria-live="polite">{selectedFileName || "No file selected"}</span>
        </div>
        <p className="panel-copy" aria-live="polite">{importMessage}</p>
      </section>
      {importItems.length > 0 ? (
        <section className="draft-list" aria-label="CSV import review">
          <div className="draft-list-heading">
            <div>
              <p className="eyebrow">Import review</p>
              <h3>Rows waiting</h3>
            </div>
            <span>{importItems.filter((item) => item.status === "pending").length} pending</span>
          </div>
          {importItems.map((item) => (
            <article className="draft-card" key={item.reviewId}>
              <div>
                <strong>Row {item.rowNumber} · {item.normalized.kind || "Unknown kind"}</strong>
                <span>{item.normalized.date || item.normalized.period_start || "No date"} · {item.normalized.account || "No account"} · {item.normalized.amount || "No amount"}</span>
                {item.errors.length > 0 ? <span>{item.errors.join(" ")}</span> : null}
                {item.aliasReview ? <span>{item.aliasReview}</span> : null}
                {item.duplicates.length > 0 ? <span>Duplicate candidate: {item.duplicates.map(duplicateCandidateLabel).join("; ")}</span> : null}
                {item.status !== "pending" ? <span>Status: {item.status}</span> : null}
              </div>
                <div className="record-actions">
                <button className="text-action" type="button" disabled={!item.ok || Boolean(item.aliasReview) || item.duplicates.length > 0 || item.status !== "pending"} onClick={() => confirmImport(item)}>Confirm import row {item.rowNumber}</button>
                {item.duplicates.length > 0 ? <>
                  <button className="text-action" type="button" disabled={!item.ok || Boolean(item.aliasReview) || item.status !== "pending"} onClick={() => keepSeparate(item)}>Keep separate row {item.rowNumber}</button>
                  <button className="text-action" type="button" disabled={item.status !== "pending"} onClick={() => linkExisting(item)}>Link existing row {item.rowNumber}</button>
                  <button className="text-action" type="button" disabled={!item.ok || Boolean(item.aliasReview) || item.status !== "pending"} onClick={() => mergeIntoDraft(item)}>Merge to draft row {item.rowNumber}</button>
                </> : null}
                <button className="text-action danger-action" type="button" disabled={item.status !== "pending"} onClick={() => skipImport(item)}>Skip row {item.rowNumber}</button>
              </div>
            </article>
          ))}
        </section>
      ) : null}
      <section className="portability-section" aria-labelledby="ledger-export-heading">
        <h3 id="ledger-export-heading">Export ledger</h3>
        <p className="panel-copy">Choose a clean format. Image bytes are never included.</p>
      <div className="export-actions">
        <button className="secondary-action" type="button" onClick={() => downloadTextFile(serializeCleanCsv(records), "mealledger-ledger.csv", "text/csv;charset=utf-8")}>Export CSV</button>
        <button className="secondary-action" type="button" onClick={() => downloadTextFile(serializeCleanJson(records), "mealledger-ledger.json", "application/json;charset=utf-8")}>Export JSON</button>
        <button className="secondary-action" type="button" disabled={exporting} onClick={() => { exportZip().catch(() => undefined); }}>{exporting ? `Exporting ZIP ${exportProgress}%` : "Export ZIP"}</button>
      </div>
      {exportMessage ? <p className="panel-copy" aria-live="polite">{exportMessage}</p> : null}
      </section>
    </Panel>
  );
}

function NotFoundPage({ navigate }: Readonly<{ navigate: (item: NavItem) => void }>) {
  return (
    <Panel title="Page not found" eyebrow="Safe recovery">
      <p className="panel-copy">This page is not part of the current workspace. Return to Overview.</p>
      <button className="secondary-action align-start" type="button" onClick={() => navigate(navItemFor("overview"))}>
        <Home size={18} aria-hidden="true" />
        Go to Overview
      </button>
    </Panel>
  );
}

function Panel({ title, eyebrow, children }: Readonly<{ title: string; eyebrow: string; children: React.ReactNode }>) {
  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
      </div>
      {children}
    </article>
  );
}

function EmptyMetric({ label, value, detail }: Readonly<{ label: string; value: string; detail: string }>) {
  return (
    <article className="summary-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

const kindLabels: Record<DraftForm["kind"], string> = {
  expense: "Expense",
  income: "Income",
  transfer: "Transfer",
  refund: "Refund",
  "fund-addition": "Initial funding",
  adjustment: "Balance adjustment",
  "unresolved-expense": "Unresolved expense",
};

function kindLabel(kind: DraftForm["kind"]): string {
  return kindLabels[kind];
}

function routeTitle(route: AppRoute) {
  switch (route) {
    case "overview":
      return "Overview";
    case "ledger":
      return "Ledger";
    case "capture":
      return "Capture";
    case "settings":
      return "Settings";
    default:
      return "Unknown route";
  }
}
