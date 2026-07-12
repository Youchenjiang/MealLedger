import { useEffect, useMemo, useState } from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import {
  AlertCircle,
  Banknote,
  Camera,
  CheckCircle2,
  CloudOff,
  Home,
  ImagePlus,
  LogIn,
  Plus,
  ReceiptText,
  Settings,
  ShieldCheck,
  Upload,
  Wifi,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { isSupabaseConfigured } from "./lib/supabase";
import type { AppLocation, AppRoute, AuthState, NavItem } from "./types";
import { createTransactionDraft, draftKinds, missingCounterpartyLabel, missingItemNameLabel, monthToPeriodRange, type DraftForm, type TransactionDraft } from "./appShell/drafts";
import { createLocalAccount, type LocalAccount } from "./manualLedger/accounts";
import { calculateAccountBalances, formatAccountBalance } from "./manualLedger/balances";
import { appendIdempotentRecords, createOfficialRecordBundle, updateOfficialRecord, voidOfficialRecord, type EditableRecordFields, type LocalAuditEvent, type LocalLedgerRecord } from "./manualLedger/records";

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

let draftSequence = 0;

const draftsStorageKey = "mealledger.app-shell.drafts";
const accountsStorageKey = "mealledger.manual-ledger.accounts";
const recordsStorageKey = "mealledger.manual-ledger.records";
const auditEventsStorageKey = "mealledger.manual-ledger.audit-events";
const categoriesStorageKey = "mealledger.manual-ledger.custom-categories";

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

function draftDisplayName(draft: TransactionDraft): string {
  return draft.kind === "transfer" ? `${draft.account} to ${draft.transferAccount}` : draft.counterparty;
}

function recordDisplayName(record: LocalLedgerRecord): string {
  return record.kind === "transfer" ? `${record.accountName} to ${record.transferAccountName}` : record.counterparty || record.reason || record.kind;
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
    return "CSV and JSON exports stay focused on ledger data. Receipt and meal photos remain separate files.";
  }

  const noun = draftCount === 1 ? "draft" : "drafts";
  return `${draftCount} ${noun} can be reviewed here; confirmation arrives later.`;
}

function counterpartyLabel(kind: DraftForm["kind"]): string {
  switch (kind) {
    case "income":
      return "Source";
    case "adjustment":
      return "Reason";
    default:
      return "Merchant";
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
  const [location, setLocation] = useState<AppLocation>(routeFromLocation);
  const [authState, setAuthState] = useState<AuthState>("signed-out");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [accounts, setAccounts] = useState<LocalAccount[]>(readStoredAccounts);
  const [drafts, setDrafts] = useState<TransactionDraft[]>(readStoredDrafts);
  const [records, setRecords] = useState<LocalLedgerRecord[]>(readStoredRecords);
  const [auditEvents, setAuditEvents] = useState<LocalAuditEvent[]>(readStoredAuditEvents);
  const route = location.route;
  const draftCount = drafts.length;
  const recordCount = records.length;

  useEffect(() => {
    try {
      window.localStorage.setItem(draftsStorageKey, JSON.stringify(drafts));
    } catch {
      // Local persistence is best effort; the shell remains usable if storage is unavailable.
    }
  }, [drafts]);

  useEffect(() => {
    try {
      window.localStorage.setItem(accountsStorageKey, JSON.stringify(accounts));
      window.localStorage.setItem(recordsStorageKey, JSON.stringify(records));
      window.localStorage.setItem(auditEventsStorageKey, JSON.stringify(auditEvents));
    } catch {
      // Local persistence is best effort; the ledger remains usable for this session.
    }
  }, [accounts, auditEvents, records]);

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

  const statusItems = useMemo(() => {
    const items = [
      {
        label: isOnline ? "Sync not enabled" : "Offline",
        detail: isOnline ? "This preview keeps changes on this device." : "Drafts stay visible on this device.",
        icon: isOnline ? Wifi : WifiOff,
        tone: "neutral",
      },
      {
        label: draftCountLabel(draftCount),
        detail:
          draftCount > 0
            ? "Review or discard drafts before the later ledger workflow writes records."
            : "Nothing is waiting for review.",
        icon: draftCount > 0 ? AlertCircle : CheckCircle2,
        tone: draftCount > 0 ? "warn" : "good",
      },
    ];

    if (draftCount > 0) {
      items.push({
        label: "Local-only data",
        detail: "These drafts stay on this device until a future sync workflow is enabled.",
        icon: CloudOff,
        tone: "warn",
      });
    }

    if (recordCount > 0) {
      items.push({
        label: `${recordCount} local record${recordCount === 1 ? "" : "s"}`,
        detail: "Official manual records are stored locally until cloud sync is enabled.",
        icon: CloudOff,
        tone: "warn",
      });
    }

    return items;
  }, [draftCount, isOnline, recordCount]);

  const navigate = (item: NavItem) => {
    window.history.pushState(null, "", item.path);
    setLocation({ route: item.route, params: {} });
  };

  if (authState !== "signed-in") {
    return <SignedOutShell onSignIn={() => setAuthState("signed-in")} />;
  }

  return (
    <main className="app-shell">
      <Sidebar route={route} navigate={navigate} />

      <section className="workspace">
        <WorkspaceHeader route={route} statusItems={statusItems} />
        {renderRoute(route, drafts, setDrafts, records, setRecords, setAuditEvents, accounts, setAccounts, navigate)}
      </section>
    </main>
  );
}

function SignedOutShell({ onSignIn }: Readonly<{ onSignIn: () => void }>) {
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
        <button className="primary-action" type="button" onClick={onSignIn}>
          <LogIn size={18} aria-hidden="true" />
          Open workspace
        </button>
      </section>
    </main>
  );
}

function renderRoute(
  route: AppRoute,
  drafts: TransactionDraft[],
  setDrafts: Dispatch<SetStateAction<TransactionDraft[]>>,
  records: LocalLedgerRecord[],
  setRecords: Dispatch<SetStateAction<LocalLedgerRecord[]>>,
  setAuditEvents: Dispatch<SetStateAction<LocalAuditEvent[]>>,
  accounts: LocalAccount[],
  setAccounts: Dispatch<SetStateAction<LocalAccount[]>>,
  navigate: (item: NavItem) => void,
) {
  const draftCount = drafts.length;
  const recordCount = records.length;

  switch (route) {
    case "overview":
      return <OverviewPage draftCount={draftCount} recordCount={recordCount} accountBalances={calculateAccountBalances(accounts, records)} navigate={navigate} />;
    case "ledger":
      return (
        <LedgerPage
          records={records}
          drafts={drafts}
          navigate={navigate}
          onDiscardDraft={(id) => setDrafts((current) => current.filter((draft) => draft.id !== id))}
          onUpdateRecord={(id, patch) => {
            const record = records.find((item) => item.id === id);
            if (!record || record.recordState === "voided") {
              return;
            }

            const result = updateOfficialRecord(record, patch, new Date().toISOString());
            setRecords((current) => current.map((item) => item.id === id ? result.record : item));
            setAuditEvents((current) => [...current, result.auditEvent]);
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
          onAddAccount={(account) => setAccounts((current) => [...current, account])}
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
            return true;
          }}
        />
      );
    case "settings":
      return <SettingsPage accounts={accounts} onAddAccount={(account) => setAccounts((current) => [...current, account])} />;
    default:
      return <NotFoundPage navigate={navigate} />;
  }
}

function OverviewPage({ draftCount, recordCount, accountBalances, navigate }: Readonly<{
  draftCount: number;
  recordCount: number;
  accountBalances: ReturnType<typeof calculateAccountBalances>;
  navigate: (item: NavItem) => void;
}>) {
  const accountDetail = accountBalances.length === 0
    ? "Add accounts before recording transactions."
    : accountBalances.slice(0, 3).map((account) => `${account.name}: ${formatAccountBalance(account.balance, account.currency)}`).join(" · ");

  return (
    <div className="route-stack">
      <section className="summary-grid">
        <EmptyMetric label="Account summary" value={accountBalances.length > 0 ? `${accountBalances.length} account${accountBalances.length === 1 ? "" : "s"}` : "No balances yet"} detail={accountDetail} />
        <EmptyMetric label="Ledger records" value={recordCount > 0 ? `${recordCount} saved` : "No records"} detail={recordCount > 0 ? "Official local records are ready in Ledger." : "Your confirmed transactions will appear here."} />
        <EmptyMetric
          label="Draft reviews"
          value={draftCount > 0 ? `${draftCount} waiting` : "None"}
          detail={draftCount > 0 ? "Drafts are ready to review." : "Scans and imports will wait for review."}
        />
      </section>
      <section className="content-grid">
        <Panel title="Start with a new record" eyebrow="First step">
          <p className="panel-copy">
            Begin with a transaction draft, then review it in Ledger. Confirmation is part of a later
            ledger workflow.
          </p>
              <button className="secondary-action align-start" type="button" onClick={() => navigate(navItemFor("capture"))}>
            Start a record
          </button>
        </Panel>
        <Panel title="Review before it counts" eyebrow="Data safety">
          <p className="panel-copy">
            Imported rows, scanned receipts, meal photos, and AI suggestions stay as drafts until a
            later ledger workflow confirms them.
          </p>
        </Panel>
      </section>
    </div>
  );
}

function LedgerPage({
  records,
  drafts,
  navigate,
  onDiscardDraft,
  onUpdateRecord,
  onVoidRecord,
}: Readonly<{
  records: LocalLedgerRecord[];
  drafts: TransactionDraft[];
  navigate: (item: NavItem) => void;
  onDiscardDraft: (id: string) => void;
  onUpdateRecord: (id: string, patch: Partial<EditableRecordFields>) => void;
  onVoidRecord: (id: string) => void;
}>) {
  const draftCount = drafts.length;
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
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
          <p className="panel-copy">Manual records are written locally as official ledger records. Cloud sync is not enabled yet.</p>
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
            editingRecordId === record.id && record.recordState !== "voided" ? (
              <RecordEditor
                key={record.id}
                record={record}
                onCancel={() => setEditingRecordId(null)}
                onSave={(patch) => {
                  onUpdateRecord(record.id, patch);
                  setEditingRecordId(null);
                }}
              />
            ) : (
              <article className={`draft-card ${record.recordState === "voided" ? "voided-record" : ""}`} key={record.id}>
                <div>
                  <strong>{recordDisplayName(record)}</strong>
                  <span>{record.localDate} · {record.accountName} · {record.category || record.reason || "No category"}</span>
                </div>
                <div className="draft-amount">
                  <strong>{record.currency} {record.amount}</strong>
                  <span>{record.kind} · {record.recordState === "voided" ? "voided" : record.status}</span>
                </div>
                {record.recordState === "voided" ? (
                  <span className="record-state-label">Voided</span>
                ) : (
                  <div className="record-actions">
                    <button className="text-action" type="button" onClick={() => setEditingRecordId(record.id)}>Edit</button>
                    <button
                      className="text-action danger-action"
                      type="button"
                      onClick={() => {
                        if (window.confirm("Void this ledger record? It will remain in history and be excluded from active totals.")) {
                          onVoidRecord(record.id);
                        }
                      }}
                    >
                      Void
                    </button>
                  </div>
                )}
              </article>
            )
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
              <button className="text-action" type="button" onClick={() => onDiscardDraft(draft.id)}>
                Discard
              </button>
            </article>
          ))}
        </section>
      ) : null}
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
      <label>
        <span>Amount</span>
        <input required inputMode="decimal" type="number" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </label>
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

type CaptureActionData = { title: string; detail: string; icon: LucideIcon; available: boolean };

function CaptureAction({ action }: Readonly<{ action: CaptureActionData }>) {
  const Icon = action.icon;
  const content = (
    <>
      <Icon size={22} aria-hidden="true" />
      <span>
        <strong>{action.title}</strong>
        <small>{action.detail}</small>
        <em>{action.available ? "Manual draft" : "Coming soon"}</em>
      </span>
    </>
  );

  return action.available ? (
    <a className="action-card primary-card" href="#manual-draft-form">{content}</a>
  ) : (
    <button className="action-card unavailable" disabled type="button">{content}</button>
  );
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
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  required?: boolean;
  allowNegative?: boolean;
  onChange: (value: string) => void;
}) {
  const steps = [-1000, -100, -10, 10, 100, 1000];
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
          placeholder="100"
        />
        <div className="amount-steps" aria-label={`${label} quick amount changes`}>
          {steps.map((step) => (
            <button
              key={step}
              className="amount-step"
              type="button"
              aria-label={`${step > 0 ? "Increase" : "Decrease"} ${label} by ${Math.abs(step)}`}
              disabled={!allowNegative && step < 0 && (!Number.isFinite(currentAmount) || currentAmount <= 0)}
              onClick={() => onChange(adjustAmount(value, step, allowNegative))}
            >
              {step > 0 ? `+${step === 1000 ? "1k" : step}` : step === -1000 ? "-1k" : step}
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
  error,
  onAccountNameChange,
  onCurrencyChange,
  onConfirm,
  onCancel,
}: {
  accountName: string;
  currency: string;
  error: string;
  onAccountNameChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="quick-account" aria-label="Quick account setup">
      <label>
        <span>New account name</span>
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
      <div className="quick-account-actions">
        <button className="primary-action" type="button" onClick={onConfirm}>Add and select</button>
        <button className="quiet-action" type="button" onClick={onCancel}>Cancel</button>
      </div>
      {error ? <p className="quick-account-error" role="alert">{error}</p> : null}
    </section>
  );
}

function CapturePage({
  records,
  accounts,
  navigate,
  onAddAccount,
  onSaveRecord,
}: Readonly<{
  records: LocalLedgerRecord[];
  accounts: LocalAccount[];
  navigate: (item: NavItem) => void;
  onAddAccount: (account: LocalAccount) => void;
  onSaveRecord: (draft: TransactionDraft) => boolean;
}>) {
  const [form, setForm] = useState<DraftForm>({
    date: localDate(),
    account: "",
    kind: "expense",
    category: "",
    counterparty: "",
    counterpartyMissing: false,
    itemName: "",
    itemNameMissing: false,
    transferAccount: "",
    transferMode: "same-currency",
    amount: "",
    currency: "TWD",
    destinationAmount: "",
    destinationCurrency: "JPY",
    feeEnabled: false,
    feeAccount: "",
    feeAmount: "",
    feeCurrency: "TWD",
    feeCategory: "",
    refundReason: "",
    refundSubtype: "refund",
    refundLinkedRecordId: "",
    refundExcessHandling: "unclassified",
    reason: "",
    timePrecision: "day",
    periodStart: "",
    periodEnd: "",
    note: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [quickAccountField, setQuickAccountField] = useState<"account" | "transferAccount" | "feeAccount" | null>(null);
  const [quickAccountName, setQuickAccountName] = useState("");
  const [quickAccountCurrency, setQuickAccountCurrency] = useState("TWD");
  const [quickAccountError, setQuickAccountError] = useState("");
  const [customCategories, setCustomCategories] = useState<string[]>(readStoredCategories);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [quickCategoryName, setQuickCategoryName] = useState("");
  const [quickCategoryError, setQuickCategoryError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    try {
      window.localStorage.setItem(categoriesStorageKey, JSON.stringify(customCategories));
    } catch {
      // Category persistence is best effort while the account and record stores remain local-first.
    }
  }, [customCategories]);

  const recordCount = records.length;
  const actions = [
    {
      title: "Record a transaction",
      detail: "Save expenses, income, transfers, refunds, and adjustments to the local ledger.",
      icon: Banknote,
      available: true,
    },
    {
      title: "Scan receipt or invoice",
      detail: "Create a draft from a source image; ledger confirmation arrives in a later workflow.",
      icon: ReceiptText,
      available: false,
    },
    {
      title: "Attach meal photo",
      detail: "Meal notes can support a transaction, but ordinary accounting never requires them.",
      icon: ImagePlus,
      available: false,
    },
    {
      title: "Attachment",
      detail: "Keep supporting evidence separate from clean ledger exports.",
      icon: Upload,
      available: false,
    },
  ];

  const updateForm = (field: keyof DraftForm, value: string) => {
    setFormError(null);
    setSavedMessage("");
    setForm((current) => ({ ...current, [field]: value }));
  };

  const isTransfer = form.kind === "transfer";
  const needsCategory = form.kind === "expense" || form.kind === "income" || form.kind === "refund";
  const counterpartyLabel =
    form.kind === "expense" ? "Merchant" : form.kind === "income" || form.kind === "fund-addition" ? "Source" : "Merchant or source";
  const needsCounterparty = form.kind === "expense" || form.kind === "income" || form.kind === "refund" || form.kind === "fund-addition";
  const isUnresolvedExpense = form.kind === "unresolved-expense";
  const hasSelectedAccount = accounts.some((account) => account.name === form.account);
  const categoryOptions = (form.kind === "income" ? incomeCategories : expenseCategories).concat(customCategories);
  const refundableRecords = records.filter((record) => record.kind === "expense" && record.recordState !== "voided");
  const merchantSuggestions = form.counterparty.trim()
    ? records.filter((record) => record.recordState !== "voided" && record.counterparty.toLocaleLowerCase().includes(form.counterparty.trim().toLocaleLowerCase())).slice(0, 5)
    : [];
  const itemSuggestions = form.itemName.trim()
    ? records.filter((record) => record.recordState !== "voided" && record.itemName && record.itemName.toLocaleLowerCase().includes(form.itemName.trim().toLocaleLowerCase())).slice(0, 5)
    : [];
  const selectedRefundRecord = refundableRecords.find((record) => record.id === form.refundLinkedRecordId);
  const refundExceedsLinkedAmount = Boolean(
    form.kind === "refund"
      && form.refundSubtype === "payback"
      && selectedRefundRecord
      && Number(form.amount) > Number(selectedRefundRecord.amount),
  );

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

  const beginQuickAccountSetup = (field: "account" | "transferAccount" | "feeAccount") => {
    setQuickAccountField(field);
    setQuickAccountName("");
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
      ...(field === "counterparty"
        ? { counterpartyMissing: missing, counterparty: missing ? missingCounterpartyLabel : "" }
        : { itemNameMissing: missing, itemName: missing ? missingItemNameLabel : "" }),
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

    if (refundExceedsLinkedAmount && form.refundExcessHandling === "unclassified") {
      setFormError("Classify the amount above the linked expense before saving this payback.");
      return;
    }

    if (!onSaveRecord(nextDraft)) {
      setFormError("This record could not be saved. Check the selected accounts and amounts.");
      return;
    }

    setSavedMessage("Record saved to the local ledger.");
    setForm((current) => ({
      ...current,
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
      refundExcessHandling: "unclassified",
      reason: "",
      periodStart: "",
      periodEnd: "",
    }));
  };

  const addQuickAccount = () => {
    const account = createLocalAccount(quickAccountName, quickAccountCurrency, crypto.randomUUID());

    if (!quickAccountField) {
      return;
    }

    if (!account) {
      setQuickAccountError("Enter an account name before adding it.");
      return;
    }

    if (accounts.some((item) => item.name.toLocaleLowerCase() === account.name.toLocaleLowerCase())) {
      setQuickAccountError("An account with this name already exists.");
      return;
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

  return (
    <section className="capture-layout">
      <Panel title="Choose how to start" eyebrow="Input sources">
        <p className="panel-copy">
          Manual entries are saved as official local ledger records. Scans, meal photos, and attachments
          remain unavailable until their own workflows are implemented.
        </p>
        <div className="planned-actions">
          {actions.map((action) => {
            const Icon = action.icon;
            if (action.available) {
              return (
                <a className="action-card primary-card" href="#manual-draft-form" key={action.title}>
                  <Icon size={22} aria-hidden="true" />
                  <span>
                    <strong>{action.title}</strong>
                    <small>{action.detail}</small>
                    <em>Manual record</em>
                  </span>
                </a>
              );
            }

            return (
              <button className="action-card unavailable" disabled type="button" key={action.title}>
                <Icon size={22} aria-hidden="true" />
                <span>
                  <strong>{action.title}</strong>
                  <small>{action.detail}</small>
                  <em>Coming soon</em>
                </span>
              </button>
            );
          })}
        </div>
      </Panel>
      <Panel title="Manual ledger record" eyebrow="Official local record">
        <form className="draft-form" id="manual-draft-form" onSubmit={handleSubmit}>
          {!isUnresolvedExpense ? (
            <label>
              <span>Date</span>
              <input required type="date" value={form.date} onChange={(event) => updateForm("date", event.target.value)} />
            </label>
          ) : null}
          {isUnresolvedExpense ? (
            <section className="full-span time-precision-fields" aria-label="Unresolved expense timing">
              <fieldset className="segmented-fieldset">
                <legend>Time precision</legend>
                <div className="segmented-control">
                {(["day", "month", "period"] as const).map((precision) => (
                  <label
                    className={form.timePrecision === precision ? "active" : ""}
                    key={precision}
                  >
                    <input checked={form.timePrecision === precision} name="time-precision" type="radio" value={precision} onChange={() => setTimePrecision(precision)} />
                    <span>{precision === "day" ? "Day" : precision === "month" ? "Month" : "Period"}</span>
                  </label>
                ))}
                </div>
              </fieldset>
              {form.timePrecision === "day" ? (
                <label>
                  <span>Date</span>
                  <input required type="date" value={form.date} onChange={(event) => updateForm("date", event.target.value)} />
                </label>
              ) : null}
              {form.timePrecision === "month" ? (
                <label>
                  <span>Month to record</span>
                  <input required type="month" value={form.periodStart.slice(0, 7)} onChange={(event) => setMonthRange(event.target.value)} />
                </label>
              ) : null}
              {form.timePrecision === "period" ? (
                <div className="period-range">
                  <label>
                    <span>Period start</span>
                    <input required type="date" value={form.periodStart} onChange={(event) => updateForm("periodStart", event.target.value)} />
                  </label>
                  <label>
                    <span>Period end</span>
                    <input required type="date" value={form.periodEnd} onChange={(event) => updateForm("periodEnd", event.target.value)} />
                  </label>
                </div>
              ) : null}
            </section>
          ) : null}
          <div className="form-field">
            <label htmlFor="entry-account">
              <span>{isTransfer ? "Source account" : "Account"}</span>
            </label>
            <div className="field-control-row">
              <select
                id="entry-account"
                required
                disabled={accounts.length === 0}
                value={form.account}
                onChange={(event) => selectSourceAccount(event.target.value)}
              >
                <option value="">{accounts.length === 0 ? "Add an account" : "Select an account"}</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.name}>
                    {account.name} ({account.currency})
                  </option>
                ))}
              </select>
              <button className="icon-button" type="button" aria-label="Add account" title="Add account" onClick={() => beginQuickAccountSetup("account")}>
                <Plus size={18} aria-hidden="true" />
              </button>
            </div>
            {accounts.length === 0 ? <p className="field-help">Add an account to start recording.</p> : null}
            {quickAccountField === "account" ? (
              <QuickAccountSetup
                accountName={quickAccountName}
                currency={quickAccountCurrency}
                error={quickAccountError}
                onAccountNameChange={(value) => { setQuickAccountName(value); setQuickAccountError(""); }}
                onCurrencyChange={setQuickAccountCurrency}
                onConfirm={addQuickAccount}
                onCancel={() => { setQuickAccountField(null); setQuickAccountError(""); }}
              />
            ) : null}
          </div>
          <label>
            <span>Type</span>
            <select value={form.kind} onChange={(event) => setRecordKind(event.target.value as DraftForm["kind"])}>
              {draftKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {kindLabel(kind)}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="entry-details" disabled={!hasSelectedAccount}>
          {needsCategory ? (
            <div className="form-field">
              <label htmlFor="entry-category">
                <span>Category</span>
              </label>
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
                  <label>
                    <span>New category name</span>
                    <input value={quickCategoryName} onChange={(event) => { setQuickCategoryName(event.target.value); setQuickCategoryError(""); }} placeholder="Household" />
                  </label>
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
            <div className="form-field">
              <label htmlFor="entry-counterparty">
                <span>{counterpartyLabel}</span>
              </label>
              <input
                id="entry-counterparty"
                required
                pattern=".*\S.*"
                title={`Enter a ${counterpartyLabel.toLocaleLowerCase()}.`}
                value={form.counterparty}
                disabled={form.kind === "expense" && form.counterpartyMissing}
                onChange={(event) => updateForm("counterparty", event.target.value)}
              />
              {form.kind === "expense" ? (
                <label className="checkbox-field inline-checkbox">
                  <input type="checkbox" checked={form.counterpartyMissing} onChange={(event) => setMissingExpenseField("counterparty", event.target.checked)} />
                  <span>Merchant unavailable</span>
                </label>
              ) : null}
              {merchantSuggestions.length > 0 && !form.counterpartyMissing ? (
                <HistorySuggestions records={merchantSuggestions} source="merchant" onApply={applySuggestion} />
              ) : null}
            </div>
          ) : null}
          {form.kind === "refund" ? (
            <>
              <label>
                <span>Refund type</span>
                <select value={form.refundSubtype} onChange={(event) => updateForm("refundSubtype", event.target.value as DraftForm["refundSubtype"])}>
                  <option value="refund">Store refund</option>
                  <option value="payback">Friend payback</option>
                </select>
              </label>
              {form.refundSubtype === "payback" ? (
                <label>
                  <span>Original expense</span>
                  <select required value={form.refundLinkedRecordId} onChange={(event) => updateForm("refundLinkedRecordId", event.target.value)}>
                    <option value="">Select an expense to link</option>
                    {refundableRecords.map((record) => (
                      <option key={record.id} value={record.id}>
                        {record.localDate} · {record.counterparty} · {record.currency} {record.amount}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </>
          ) : null}
          {form.kind === "expense" ? (
            <div className="form-field">
              <label htmlFor="entry-item-name">
                <span>Item name</span>
              </label>
              <input id="entry-item-name" required pattern=".*\S.*" disabled={form.itemNameMissing} value={form.itemName} onChange={(event) => updateForm("itemName", event.target.value)} />
              <label className="checkbox-field inline-checkbox">
                <input type="checkbox" checked={form.itemNameMissing} onChange={(event) => setMissingExpenseField("itemName", event.target.checked)} />
                <span>Item unavailable</span>
              </label>
              {itemSuggestions.length > 0 && !form.itemNameMissing ? (
                <HistorySuggestions records={itemSuggestions} source="item" onApply={applySuggestion} />
              ) : null}
            </div>
          ) : null}
          {isTransfer ? (
            <>
              <section className="transfer-mode full-span" aria-label="Transfer type">
                <fieldset className="segmented-fieldset">
                  <legend>Transfer type</legend>
                  <div className="segmented-control">
                  {(["same-currency", "cross-currency"] as const).map((mode) => (
                    <label
                      className={form.transferMode === mode ? "active" : ""}
                      key={mode}
                    >
                      <input checked={form.transferMode === mode} name="transfer-mode" type="radio" value={mode} onChange={() => setTransferMode(mode)} />
                      <span>{mode === "same-currency" ? "Same currency" : "Cross currency"}</span>
                    </label>
                  ))}
                  </div>
                </fieldset>
              </section>
              <div className="form-field">
                <label htmlFor="entry-destination-account">
                  <span>Destination account</span>
                </label>
                <div className="field-control-row">
                  <select
                    id="entry-destination-account"
                    required
                    disabled={accounts.length < 2}
                    value={form.transferAccount}
                    onChange={(event) => selectDestinationAccount(event.target.value)}
                  >
                    <option value="">{accounts.length < 2 ? "Add another account" : "Select destination account"}</option>
                    {accounts
                      .filter((account) => account.name !== form.account && (form.transferMode !== "same-currency" || account.currency === form.currency))
                      .map((account) => (
                        <option key={account.id} value={account.name}>
                          {account.name} ({account.currency})
                        </option>
                      ))}
                  </select>
                  <button className="icon-button" type="button" aria-label="Add destination account" title="Add destination account" onClick={() => beginQuickAccountSetup("transferAccount")}>
                    <Plus size={18} aria-hidden="true" />
                  </button>
                </div>
                {quickAccountField === "transferAccount" ? (
                  <QuickAccountSetup
                    accountName={quickAccountName}
                    currency={quickAccountCurrency}
                    error={quickAccountError}
                    onAccountNameChange={(value) => { setQuickAccountName(value); setQuickAccountError(""); }}
                    onCurrencyChange={setQuickAccountCurrency}
                    onConfirm={addQuickAccount}
                    onCancel={() => { setQuickAccountField(null); setQuickAccountError(""); }}
                  />
                ) : null}
              </div>
            </>
          ) : null}
          <AmountField
            id="entry-amount"
            label={isTransfer && form.transferMode === "cross-currency" ? "Source amount" : "Amount"}
            required
            value={form.amount}
            allowNegative={form.kind === "adjustment"}
            onChange={(value) => updateForm("amount", value)}
          />
          <div className="form-field">
            <span>{isTransfer && form.transferMode === "cross-currency" ? "Source currency" : "Currency"}</span>
            <output className="derived-value">{hasSelectedAccount ? form.currency : "Select an account first"}</output>
          </div>
          {isTransfer && form.transferMode === "cross-currency" ? (
            <>
              <AmountField
                id="entry-destination-amount"
                label="Destination amount"
                required
                value={form.destinationAmount}
                onChange={(value) => updateForm("destinationAmount", value)}
              />
              <div className="form-field">
                <span>Destination currency</span>
                <output className="derived-value">{form.destinationCurrency}</output>
              </div>
            </>
          ) : null}
          {isTransfer ? (
            <label className="full-span checkbox-field">
              <input type="checkbox" checked={form.feeEnabled} onChange={(event) => setForm((current) => ({ ...current, feeEnabled: event.target.checked }))} />
              <span>Add transfer fee</span>
            </label>
          ) : null}
          {isTransfer && form.feeEnabled ? (
            <>
              <div className="form-field">
                <label htmlFor="entry-fee-account">
                  <span>Fee account</span>
                </label>
                <div className="field-control-row">
                  <select id="entry-fee-account" value={form.feeAccount} onChange={(event) => selectFeeAccount(event.target.value)}>
                    <option value="">Select fee account</option>
                    {accounts.map((account) => <option key={account.id} value={account.name}>{account.name} ({account.currency})</option>)}
                  </select>
                  <button className="icon-button" type="button" aria-label="Add fee account" title="Add fee account" onClick={() => beginQuickAccountSetup("feeAccount")}>
                    <Plus size={18} aria-hidden="true" />
                  </button>
                </div>
                {quickAccountField === "feeAccount" ? (
                  <QuickAccountSetup
                    accountName={quickAccountName}
                    currency={quickAccountCurrency}
                    error={quickAccountError}
                    onAccountNameChange={(value) => { setQuickAccountName(value); setQuickAccountError(""); }}
                    onCurrencyChange={setQuickAccountCurrency}
                    onConfirm={addQuickAccount}
                    onCancel={() => { setQuickAccountField(null); setQuickAccountError(""); }}
                  />
                ) : null}
              </div>
              <AmountField
                id="entry-fee-amount"
                label="Fee amount"
                value={form.feeAmount}
                onChange={(value) => updateForm("feeAmount", value)}
              />
              <div className="form-field">
                <span>Fee currency</span>
                <output className="derived-value">{form.feeCurrency}</output>
              </div>
              <label>
                <span>Fee category</span>
                <input value={form.feeCategory} onChange={(event) => updateForm("feeCategory", event.target.value)} placeholder="Fees" />
              </label>
            </>
          ) : null}
          {form.kind === "refund" ? (
            <>
              <label className="full-span">
                <span>Refund reason</span>
                <textarea required value={form.refundReason} onChange={(event) => updateForm("refundReason", event.target.value)} />
              </label>
              {refundExceedsLinkedAmount ? (
                <label className="full-span warning-field">
                  <span>Excess amount handling</span>
                  <select aria-label="Excess amount handling" value={form.refundExcessHandling} onChange={(event) => updateForm("refundExcessHandling", event.target.value as DraftForm["refundExcessHandling"])}>
                    <option value="unclassified">Choose a classification</option>
                    <option value="income">Classify excess as income</option>
                    <option value="negative-expense">Classify excess as additional negative expense</option>
                  </select>
                  <small>This payback exceeds the linked expense and needs an explicit classification.</small>
                </label>
              ) : null}
            </>
          ) : null}
          {form.kind === "adjustment" ? (
            <label className="full-span">
              <span>Adjustment reason</span>
              <textarea required value={form.reason} onChange={(event) => updateForm("reason", event.target.value)} />
            </label>
          ) : null}
          </fieldset>
          {formError ? <p className="form-error full-span" role="alert">{formError}</p> : null}
          {savedMessage ? <p className="form-success full-span" role="status">{savedMessage}</p> : null}
          <button className="primary-action align-start" disabled={!hasSelectedAccount} type="submit">
            {hasSelectedAccount ? "Save record" : "Add an account first"}
          </button>
        </form>
      </Panel>
      {recordCount > 0 ? (
        <Panel title="Record saved" eyebrow="Local ledger">
          <p className="panel-copy">{recordCount} official local record{recordCount === 1 ? "" : "s"} stored on this device.</p>
          <button className="secondary-action align-start" type="button" onClick={() => navigate(navItemFor("ledger"))}>
            Open Ledger
          </button>
        </Panel>
      ) : null}
    </section>
  );
}

function CaptureSourcesPanel({ actions }: Readonly<{ actions: CaptureActionData[] }>) {
  return (
    <Panel title="Choose how to start" eyebrow="Input sources">
      <p className="panel-copy">
        Manual entries, scans, meal photos, and attachments start as drafts. This app shell lets
        you review or discard them; ledger confirmation arrives later.
      </p>
      <div className="planned-actions">
        {actions.map((action) => <CaptureAction action={action} key={action.title} />)}
      </div>
    </Panel>
  );
}

function ManualDraftPanel({
  accounts,
  form,
  updateForm,
  onSubmit,
  formError,
}: Readonly<{
  accounts: LocalAccount[];
  form: DraftForm;
  updateForm: (field: keyof DraftForm, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  formError: string | null;
}>) {
  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Local draft</p>
          <h2>Manual transaction draft</h2>
        </div>
      </div>
      <ManualDraftForm accounts={accounts} form={form} updateForm={updateForm} onSubmit={onSubmit} formError={formError} />
    </article>
  );
}

function ManualDraftForm({
  accounts,
  form,
  updateForm,
  onSubmit,
  formError,
}: Readonly<{
  accounts: LocalAccount[];
  form: DraftForm;
  updateForm: (field: keyof DraftForm, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  formError: string | null;
}>) {
  return (
    <form className="draft-form" id="manual-draft-form" onSubmit={onSubmit}>
      <label>
        <span>Date</span>
        <input required type="date" value={form.date} onChange={(event) => updateForm("date", event.target.value)} />
      </label>
      <label>
        <span>Account</span>
        <select required disabled={accounts.length === 0} value={form.account} onChange={(event) => updateForm("account", event.target.value)}>
          <option value="">{accounts.length === 0 ? "Create an account in Settings first" : "Select an account"}</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.name}>
              {account.name} ({account.currency})
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Type</span>
        <select value={form.kind} onChange={(event) => updateForm("kind", event.target.value as DraftForm["kind"])}>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
          <option value="transfer">Transfer</option>
          <option value="refund">Refund</option>
          <option value="adjustment">Adjustment</option>
        </select>
      </label>
      <DraftKindFields accounts={accounts} form={form} updateForm={updateForm} />
      <label>
        <span>Amount</span>
        <input required inputMode="decimal" min="0" step="any" type="number" value={form.amount} onChange={(event) => updateForm("amount", event.target.value)} placeholder="100" />
      </label>
      <label>
        <span>Currency</span>
        <select value={form.currency} onChange={(event) => updateForm("currency", event.target.value)}>
          <option value="TWD">TWD</option>
          <option value="JPY">JPY</option>
          <option value="USD">USD</option>
        </select>
      </label>
      <label className="full-span">
        <span>Note</span>
        <textarea value={form.note} onChange={(event) => updateForm("note", event.target.value)} placeholder="Optional context before review" />
      </label>
      {formError ? <p className="form-error full-span" role="alert">{formError}</p> : null}
      <button className="primary-action align-start" type="submit">Create draft</button>
    </form>
  );
}

function DraftKindFields({ accounts, form, updateForm }: Readonly<{ accounts: LocalAccount[]; form: DraftForm; updateForm: (field: keyof DraftForm, value: string) => void }>) {
  if (form.kind === "transfer") {
    return (
      <label>
        <span>Transfer account</span>
        <select required disabled={accounts.length < 2} value={form.transferAccount} onChange={(event) => updateForm("transferAccount", event.target.value)}>
          <option value="">{accounts.length < 2 ? "Create another account in Settings first" : "Select destination account"}</option>
          {accounts.filter((account) => account.name !== form.account).map((account) => (
            <option key={account.id} value={account.name}>
              {account.name} ({account.currency})
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <>
      <label>
        <span>Category</span>
        <input required pattern=".*\S.*" title="Enter a category." value={form.category} onChange={(event) => updateForm("category", event.target.value)} placeholder="Daily" />
      </label>
      <label>
        <span>{counterpartyLabel(form.kind)}</span>
        <input required pattern=".*\S.*" title="Enter the source, merchant, or reason." value={form.counterparty} onChange={(event) => updateForm("counterparty", event.target.value)} placeholder={form.kind === "income" ? "Salary" : "7-Eleven"} />
      </label>
    </>
  );
}

function SettingsPage({ accounts, onAddAccount }: Readonly<{ accounts: LocalAccount[]; onAddAccount: (account: LocalAccount) => void }>) {
  const [accountName, setAccountName] = useState("");
  const [accountCurrency, setAccountCurrency] = useState("TWD");
  const dataTools = [
    {
      title: "CSV import review",
      detail: "Map spreadsheet columns, preview errors, and create drafts before ledger writes.",
    },
    {
      title: "Clean ledger export",
      detail: "Export CSV and JSON without bundling receipt or meal photo bytes.",
    },
    {
      title: "Statement reconciliation",
      detail: "Bank or wallet records can later match confirmed transactions.",
    },
  ];

  const handleAccountSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const account = createLocalAccount(accountName, accountCurrency, draftId());

    if (!account || accounts.some((item) => item.name.toLocaleLowerCase() === account.name.toLocaleLowerCase())) {
      return;
    }

    onAddAccount(account);
    setAccountName("");
  };

  return (
    <section className="content-grid">
      <Panel title="Accounts" eyebrow="Local setup">
        <p className="panel-copy">Create the accounts that manual records may use. This preview keeps them only in the current workspace session.</p>
        <form className="draft-form" onSubmit={handleAccountSubmit}>
          <label>
            <span>Account name</span>
            <input required pattern=".*\S.*" value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Daily wallet" />
          </label>
          <label>
            <span>Currency</span>
            <select value={accountCurrency} onChange={(event) => setAccountCurrency(event.target.value)}>
              <option value="TWD">TWD</option>
              <option value="JPY">JPY</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <button className="primary-action align-start" type="submit">Add account</button>
        </form>
        {accounts.length === 0 ? <p className="panel-copy">No accounts yet. Add one before creating a manual record.</p> : null}
        {accounts.length > 0 ? (
          <ul className="account-list" aria-label="Available accounts">
            {accounts.map((account) => (
              <li key={account.id}>
                <strong>{account.name}</strong>
                <span>{account.currency}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>
      <AccountSyncPanel />
      <ImportExportPanel dataTools={dataTools} />
    </section>
  );
}

function AccountSyncPanel() {
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
    </Panel>
  );
}

function ImportExportPanel({ dataTools }: Readonly<{ dataTools: Array<{ title: string; detail: string }> }>) {
  return (
    <Panel title="Import and export safeguards" eyebrow="Data portability">
      <p className="panel-copy">
        Clean exports include confirmed ledger records only. Attachments stay as metadata
        references, not image bytes, and CSV/JSON use the same stable field set.
      </p>
      <DataToolList items={dataTools} />
    </Panel>
  );
}

function DataToolList({ items }: Readonly<{ items: Array<{ title: string; detail: string }> }>) {
  return (
    <dl className="settings-list" aria-label="Data tool status">
      {items.map((item) => (
        <div key={item.title}>
          <dt>{item.title}</dt>
          <dd>{item.detail}</dd>
        </div>
      ))}
    </dl>
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

function kindLabel(kind: DraftForm["kind"]) {
  switch (kind) {
    case "expense":
      return "Expense";
    case "income":
      return "Income";
    case "transfer":
      return "Transfer";
    case "refund":
      return "Refund";
    case "fund-addition":
      return "Initial funding";
    case "adjustment":
      return "Balance adjustment";
    case "unresolved-expense":
      return "Unresolved expense";
  }
}

function draftSummary(draft: TransactionDraft) {
  if (draft.kind === "transfer") {
    const destination = draft.transferMode === "cross-currency" ? `${draft.destinationAmount} ${draft.destinationCurrency}` : draft.currency;
    return `${draft.account} ${draft.amount} ${draft.currency} to ${draft.transferAccount} ${destination}`;
  }

  if (draft.kind === "adjustment") {
    return `${draft.reason}, ${draft.currency} ${draft.amount}`;
  }

  if (draft.kind === "unresolved-expense") {
    return `Unresolved expense, ${draft.currency} ${draft.amount}`;
  }

  return `${draft.counterparty}, ${draft.currency} ${draft.amount}`;
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
