import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  AlertCircle,
  Banknote,
  Camera,
  CheckCircle2,
  Home,
  ImagePlus,
  LogIn,
  ReceiptText,
  Settings,
  ShieldCheck,
  Upload,
  Wifi,
  WifiOff,
} from "lucide-react";
import { isSupabaseConfigured } from "./lib/supabase";
import type { AppRoute, AuthState, NavItem } from "./types";

const navItems: NavItem[] = [
  { route: "overview", label: "Overview", path: "/overview", icon: Home },
  { route: "ledger", label: "Ledger", path: "/ledger", icon: Banknote },
  { route: "capture", label: "Capture", path: "/capture", icon: Camera },
  { route: "settings", label: "Settings", path: "/settings", icon: Settings },
];

const routeByPath = new Map(navItems.map((item) => [item.path, item.route]));

function routeFromLocation(): AppRoute {
  if (window.location.pathname === "/") {
    return "overview";
  }

  return routeByPath.get(window.location.pathname) ?? "not-found";
}

export function App() {
  const [route, setRoute] = useState<AppRoute>(routeFromLocation);
  const [authState, setAuthState] = useState<AuthState>("signed-out");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [draftCount, setDraftCount] = useState(0);

  useEffect(() => {
    const handlePopState = () => setRoute(routeFromLocation());
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
  }, [route]);

  const statusItems = useMemo(() => {
    const items = [
      {
        label: isOnline ? "Sync not enabled" : "Offline",
        detail: isOnline ? "This preview keeps changes on this device." : "Drafts stay visible on this device.",
        icon: isOnline ? Wifi : WifiOff,
        tone: "neutral",
      },
      {
        label: draftCount > 0 ? `${draftCount} draft${draftCount === 1 ? "" : "s"} waiting` : "No drafts to review",
        detail:
          draftCount > 0
            ? "Confirm drafts before they become ledger records."
            : "Nothing is waiting for confirmation.",
        icon: draftCount > 0 ? AlertCircle : CheckCircle2,
        tone: draftCount > 0 ? "warn" : "good",
      },
    ];

    return items;
  }, [isOnline, draftCount]);

  const navigate = (item: NavItem) => {
    window.history.pushState(null, "", item.path);
    setRoute(item.route);
  };

  if (authState !== "signed-in") {
    return <SignedOutShell onSignIn={() => setAuthState("signed-in")} />;
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="MealLedger navigation">
        <div className="brand">
          <div className="brand-mark">
            <ReceiptText size={20} aria-hidden="true" />
          </div>
          <div>
            <p className="brand-name">MealLedger</p>
            <p className="brand-caption">Personal ledger with optional meal notes</p>
          </div>
        </div>

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

        <div className="storage-note">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>Ledger exports stay separate from receipt and meal photos.</span>
        </div>
      </aside>

      <section className="workspace">
        <section className="page-header" aria-labelledby="page-title">
          <header className="topbar">
            <div className="topbar-title">
              <p className="eyebrow">Personal finance workspace</p>
              <h1 id="page-title">{routeTitle(route)}</h1>
            </div>
          </header>

          <section className="status-strip" aria-label="Application status">
            {statusItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  className={`status-item ${item.tone}`}
                  key={item.label}
                  title={item.detail}
                  aria-label={`${item.label}. ${item.detail}`}
                >
                  <Icon size={16} aria-hidden="true" />
                  <strong>{item.label}</strong>
                </div>
              );
            })}
          </section>
        </section>

        {renderRoute(route, draftCount, setDraftCount, navigate)}
      </section>
    </main>
  );
}

function SignedOutShell({ onSignIn }: { onSignIn: () => void }) {
  return (
    <main className="signed-out-shell">
      <section className="signed-out-panel">
        <div className="brand large">
          <div className="brand-mark">
            <ReceiptText size={22} aria-hidden="true" />
          </div>
          <div>
            <p className="brand-name">MealLedger</p>
            <p className="brand-caption">Personal finance records</p>
          </div>
        </div>
        <div>
          <p className="eyebrow">MealLedger</p>
          <h1>Track spending first, attach meals when useful.</h1>
          <p className="lede">
            Start with ledger records, keep scans and photos separate, and confirm every draft
            before it counts.
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
  draftCount: number,
  setDraftCount: Dispatch<SetStateAction<number>>,
  navigate: (item: NavItem) => void,
) {
  switch (route) {
    case "overview":
      return <OverviewPage draftCount={draftCount} navigate={navigate} />;
    case "ledger":
      return <LedgerPage draftCount={draftCount} navigate={navigate} />;
    case "capture":
      return (
        <CapturePage
          draftCount={draftCount}
          navigate={navigate}
          onCreateDraft={() => setDraftCount((count) => count + 1)}
        />
      );
    case "settings":
      return <SettingsPage />;
    default:
      return <NotFoundPage navigate={navigate} />;
  }
}

function OverviewPage({ draftCount, navigate }: { draftCount: number; navigate: (item: NavItem) => void }) {
  return (
    <div className="route-stack">
      <section className="summary-grid">
        <EmptyMetric label="Account summary" value="No balances yet" detail="Create accounts before showing totals." />
        <EmptyMetric label="Ledger records" value="No records" detail="Confirmed transactions will appear here." />
        <EmptyMetric
          label="Draft reviews"
          value={draftCount > 0 ? `${draftCount} waiting` : "None"}
          detail={draftCount > 0 ? "Drafts are ready to review." : "Scans and imports will wait for confirmation."}
        />
      </section>
      <section className="content-grid">
        <Panel title="Start with a new record" eyebrow="First step">
          <p className="panel-copy">
            Begin with a transaction draft, then confirm it before it becomes part of the ledger.
          </p>
          <button className="secondary-action align-start" type="button" onClick={() => navigate(navItems[2])}>
            Start a record
          </button>
        </Panel>
        <Panel title="Review before it counts" eyebrow="Data safety">
          <p className="panel-copy">
            Imported rows, scanned receipts, meal photos, and AI suggestions stay as drafts until
            you confirm them.
          </p>
        </Panel>
      </section>
    </div>
  );
}

function LedgerPage({ draftCount, navigate }: { draftCount: number; navigate: (item: NavItem) => void }) {
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
          <p className="panel-copy">
            Confirmed transactions appear here after review. The table keeps spreadsheet-friendly
            fields visible from the start.
          </p>
          <button className="secondary-action align-start" type="button" onClick={() => navigate(navItems[2])}>
            Start a record
          </button>
        </Panel>
        <Panel title={draftCount > 0 ? "Drafts waiting" : "Clean export"} eyebrow="Portability">
          <p className="panel-copy">
            {draftCount > 0
              ? `${draftCount} draft${draftCount === 1 ? "" : "s"} must be confirmed before appearing here.`
              : "CSV and JSON exports stay focused on ledger data. Receipt and meal photos remain separate files."}
          </p>
        </Panel>
      </section>
      <section className="table-card" aria-label="Ledger table fields">
        <div className="table-row table-head">
          {ledgerColumns.map((column) => (
            <span key={column}>{column}</span>
          ))}
        </div>
        <div className="table-empty">No confirmed ledger records yet.</div>
      </section>
    </div>
  );
}

function CapturePage({
  draftCount,
  navigate,
  onCreateDraft,
}: {
  draftCount: number;
  navigate: (item: NavItem) => void;
  onCreateDraft: () => void;
}) {
  const actions = [
    {
      title: "Record a transaction",
      detail: "The primary path for expenses, income, transfers, refunds, and adjustments.",
      icon: Banknote,
      available: true,
    },
    {
      title: "Scan receipt or invoice",
      detail: "Create a draft from a source image; confirm before it enters the ledger.",
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

  return (
    <section className="capture-layout">
      <Panel title="Choose how to start" eyebrow="Input sources">
        <p className="panel-copy">
          Manual entries, scans, meal photos, and attachments start as drafts. Confirm a draft when
          it is ready for the ledger.
        </p>
        <div className="planned-actions">
          {actions.map((action) => {
            const Icon = action.icon;
            if (action.available) {
              return (
                <button className="action-card primary-card" type="button" key={action.title} onClick={onCreateDraft}>
                  <Icon size={22} aria-hidden="true" />
                  <span>
                    <strong>{action.title}</strong>
                    <small>{action.detail}</small>
                    <em>Creates local draft</em>
                  </span>
                </button>
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
      {draftCount > 0 ? (
        <Panel title="Draft ready for review" eyebrow="Local draft">
          <p className="panel-copy">
            {draftCount} manual transaction draft{draftCount === 1 ? "" : "s"} exist locally. They
            are not confirmed ledger records yet.
          </p>
          <button className="secondary-action align-start" type="button" onClick={() => navigate(navItems[1])}>
            Review in Ledger
          </button>
        </Panel>
      ) : null}
    </section>
  );
}

function SettingsPage() {
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

  return (
    <section className="content-grid">
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
      <Panel title="Import and export safeguards" eyebrow="Data portability">
        <p className="panel-copy">
          Clean exports include confirmed ledger records only. Attachments stay as metadata
          references, not image bytes, and CSV/JSON use the same stable field set.
        </p>
        <dl className="settings-list" aria-label="Data tool status">
          {dataTools.map((item) => {
            return (
              <div key={item.title}>
                <dt>{item.title}</dt>
                <dd>{item.detail}</dd>
              </div>
            );
          })}
        </dl>
      </Panel>
    </section>
  );
}

function NotFoundPage({ navigate }: { navigate: (item: NavItem) => void }) {
  return (
    <Panel title="Page not found" eyebrow="Safe recovery">
      <p className="panel-copy">This page is not part of the current workspace. Return to Overview.</p>
      <button className="secondary-action align-start" type="button" onClick={() => navigate(navItems[0])}>
        <Home size={18} />
        Go to Overview
      </button>
    </Panel>
  );
}

function Panel({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
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

function EmptyMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="summary-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
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
