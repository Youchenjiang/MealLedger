import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Banknote,
  BookOpen,
  Camera,
  CheckCircle2,
  Cloud,
  Database,
  Download,
  FileDown,
  FileText,
  Home,
  ImagePlus,
  LogIn,
  LogOut,
  Plus,
  ReceiptText,
  RotateCw,
  Search,
  Settings,
  ShieldCheck,
  Upload,
  Utensils,
  Wifi,
  WifiOff,
} from "lucide-react";
import { isSupabaseConfigured } from "./lib/supabase";
import type { AppRoute, AuthState, NavItem, SyncState } from "./types";

const navItems: NavItem[] = [
  { route: "overview", label: "Overview", path: "/overview", icon: Home },
  { route: "ledger", label: "Ledger", path: "/ledger", icon: Banknote },
  { route: "capture", label: "Capture", path: "/capture", icon: Camera },
  { route: "meals", label: "Meals", path: "/meals", icon: Utensils },
  { route: "imports", label: "Imports", path: "/imports", icon: FileDown },
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
  const [syncState, setSyncState] = useState<SyncState>("local-only");
  const [reviewCount, setReviewCount] = useState(0);

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
        label: isOnline ? "Online" : "Offline",
        detail: isOnline ? "Navigation remains available." : "Local draft mode is visible.",
        icon: isOnline ? Wifi : WifiOff,
        tone: isOnline ? "good" : "warn",
      },
      {
        label: syncLabel(syncState),
        detail: syncDetail(syncState),
        icon: syncState === "synced" ? CheckCircle2 : Cloud,
        tone: syncState === "failed" ? "danger" : syncState === "synced" ? "good" : "warn",
      },
    ];

    if (reviewCount > 0) {
      items.push({
        label: `${reviewCount} review items`,
        detail: "Drafts and conflicts wait here before official ledger writes.",
        icon: AlertCircle,
        tone: "warn",
      });
    }

    return items;
  }, [isOnline, reviewCount, syncState]);

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
            <p className="brand-caption">Ledger first, meals optional</p>
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
          <span>Clean ledger exports stay separate from media bytes.</span>
        </div>
      </aside>

      <section className="workspace">
        <section className="page-header" aria-labelledby="page-title">
          <header className="topbar">
            <div className="topbar-title">
              <p className="eyebrow">V1 app shell</p>
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

        {renderRoute(route, reviewCount, navigate, {
          onAddReview: () => setReviewCount((value) => (value === 0 ? 3 : value + 1)),
          onClearReview: () => setReviewCount(0),
          onSignOutPreview: () => setAuthState("signed-out"),
          onToggleLocalOnly: () => setSyncState((value) => (value === "local-only" ? "synced" : "local-only")),
          onToggleNetwork: () => setIsOnline((value) => !value),
          isOnline,
        })}
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
            <p className="brand-caption">Accounting-first personal records</p>
          </div>
        </div>
        <div>
          <p className="eyebrow">Signed-out state</p>
          <h1>Start with a safe shell before real ledger data exists.</h1>
          <p className="lede">
            Supabase Auth will connect later. This preview keeps the shell usable without real
            credentials, uploads, imports, or official ledger writes.
          </p>
        </div>
        <button className="primary-action" type="button" onClick={onSignIn}>
          <LogIn size={18} aria-hidden="true" />
          Preview signed-in shell
        </button>
      </section>
    </main>
  );
}

type PreviewControls = {
  isOnline: boolean;
  onAddReview: () => void;
  onClearReview: () => void;
  onSignOutPreview: () => void;
  onToggleLocalOnly: () => void;
  onToggleNetwork: () => void;
};

function renderRoute(
  route: AppRoute,
  reviewCount: number,
  navigate: (item: NavItem) => void,
  previewControls: PreviewControls,
) {
  switch (route) {
    case "overview":
      return <OverviewPage navigate={navigate} />;
    case "ledger":
      return <LedgerPage />;
    case "capture":
      return <CapturePage />;
    case "meals":
      return <MealsPage />;
    case "imports":
      return <ImportsPage reviewCount={reviewCount} />;
    case "settings":
      return <SettingsPage previewControls={previewControls} />;
    default:
      return <NotFoundPage navigate={navigate} />;
  }
}

function OverviewPage({ navigate }: { navigate: (item: NavItem) => void }) {
  return (
    <div className="route-stack">
      <section className="summary-grid">
        <EmptyMetric label="Account summary" value="No balances yet" detail="Create accounts before showing totals." />
        <EmptyMetric label="Recent activity" value="No records" detail="Official records will appear after confirmation." />
        <EmptyMetric label="Draft reviews" value="None" detail="Review items appear only after imports, scans, or sync conflicts." />
      </section>
      <section className="content-grid">
        <Panel title="Ledger foundation" eyebrow="Next action">
          <p className="panel-copy">
            The shell is ready for the first real ledger flow: accounts, categories, and manual
            transaction entry.
          </p>
          <button className="secondary-action align-start" type="button" onClick={() => navigate(navItems[1])}>
            <ListIcon />
            Open Ledger
          </button>
        </Panel>
        <Panel title="Local-only visibility" eyebrow="Sync safety">
          <p className="panel-copy">
            The shell reserves space for local-only warnings so offline drafts are never mistaken
            for backed-up records.
          </p>
        </Panel>
      </section>
    </div>
  );
}

function LedgerPage() {
  return (
    <div className="route-stack">
      <section className="content-grid">
        <Panel title="Ledger is empty" eyebrow="Official records">
          <p className="panel-copy">
            Manual expenses, income, transfers, refunds, fund additions, and adjustments will appear
            here after they are confirmed.
          </p>
          <div className="action-row">
            <button className="secondary-action" type="button">
              <Plus size={18} />
              Add transaction
            </button>
            <button className="secondary-action" type="button">
              <Search size={18} />
              Filters placeholder
            </button>
          </div>
        </Panel>
        <Panel title="No fake balances" eyebrow="Accounting guardrail">
          <p className="panel-copy">
            This shell avoids sample balances so smoke-test data cannot be confused with real
            account totals.
          </p>
        </Panel>
      </section>
    </div>
  );
}

function CapturePage() {
  const actions = [
    {
      title: "Manual ledger entry",
      detail: "Expense, income, transfer, refund, or adjustment.",
      icon: Banknote,
    },
    {
      title: "Scan receipt or invoice",
      detail: "Temporary source file, then user-confirmed draft.",
      icon: ReceiptText,
    },
    {
      title: "Meal photo",
      detail: "Meal record first; ledger link remains optional.",
      icon: ImagePlus,
    },
    {
      title: "Attachment",
      detail: "Attach evidence without creating a meal.",
      icon: Upload,
    },
  ];

  return (
    <section className="capture-layout">
      <Panel title="Choose a capture path" eyebrow="Capture">
        <p className="panel-copy">
          Start from the thing you have now. Nothing here creates an official ledger record until a
          later confirmation step.
        </p>
        <div className="capture-actions">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <article className="action-card planned" key={action.title}>
                <Icon size={22} aria-hidden="true" />
                <span>
                  <strong>{action.title}</strong>
                  <small>{action.detail}</small>
                  <em>Planned</em>
                </span>
              </article>
            );
          })}
        </div>
      </Panel>
    </section>
  );
}

function MealsPage() {
  return (
    <section className="content-grid">
      <Panel title="Meal timeline is empty" eyebrow="Meals">
        <p className="panel-copy">
          Meals can have zero, one, or many photos. They can link to ledger records later, but they
          do not have to.
        </p>
        <button className="secondary-action align-start" type="button">
          <Utensils size={18} />
          Add meal placeholder
        </button>
      </Panel>
      <Panel title="Future matching" eyebrow="Optional links">
        <p className="panel-copy">
          The matching flow will suggest nearby transactions by time, merchant, amount, and source
          confidence without writing official records.
        </p>
      </Panel>
    </section>
  );
}

function ImportsPage({ reviewCount }: { reviewCount: number }) {
  return (
    <section className="content-grid">
      <Panel title="Import history is empty" eyebrow="CSV and drafts">
        <p className="panel-copy">
          Spreadsheet imports, scanned source drafts, and future statement records will show their
          review status here.
        </p>
        <button className="secondary-action align-start" type="button">
          <FileText size={18} />
          CSV import placeholder
        </button>
      </Panel>
      <Panel title={`${reviewCount} draft reviews`} eyebrow="Human confirmation">
        <p className="panel-copy">
          AI, OCR, recurring records, and import candidates stay as drafts until the user confirms
          them.
        </p>
      </Panel>
    </section>
  );
}

function SettingsPage({ previewControls }: { previewControls: PreviewControls }) {
  return (
    <section className="content-grid">
      <Panel title="Account and sync" eyebrow="Settings">
        <dl className="settings-list">
          <div>
            <dt>Supabase</dt>
            <dd>{isSupabaseConfigured ? "Environment variables configured" : "Not configured for local smoke test"}</dd>
          </div>
          <div>
            <dt>Storage</dt>
            <dd>Local-only state and offline warnings are visible before backend wiring.</dd>
          </div>
        </dl>
      </Panel>
      <Panel title="Export and documentation" eyebrow="Project links">
        <div className="action-row">
          <button className="secondary-action" type="button">
            <Download size={18} />
            Export placeholder
          </button>
          <button className="secondary-action" type="button">
            <BookOpen size={18} />
            Docs placeholder
          </button>
        </div>
        <p className="panel-copy">
          Runtime UI avoids direct local file paths; implementation references remain in repository
          documentation.
        </p>
      </Panel>
      <Panel title="Preview controls" eyebrow="Local smoke test">
        <p className="panel-copy">
          These controls only exist for app-shell preview states. They will be replaced by real auth,
          sync, and review flows later.
        </p>
        <section className="mock-controls" aria-label="Smoke test controls">
          <button type="button" onClick={previewControls.onSignOutPreview}>
            <LogOut size={16} aria-hidden="true" />
            Show signed-out state
          </button>
          <button type="button" onClick={previewControls.onClearReview}>
            <CheckCircle2 size={16} aria-hidden="true" />
            Clear review mock
          </button>
          <button type="button" onClick={previewControls.onToggleNetwork}>
            {previewControls.isOnline ? <WifiOff size={16} /> : <Wifi size={16} />}
            Toggle network
          </button>
          <button type="button" onClick={previewControls.onToggleLocalOnly}>
            <Cloud size={16} />
            Toggle local-only
          </button>
          <button type="button" onClick={previewControls.onAddReview}>
            <AlertCircle size={16} />
            Add review item
          </button>
        </section>
      </Panel>
    </section>
  );
}

function NotFoundPage({ navigate }: { navigate: (item: NavItem) => void }) {
  return (
    <Panel title="Page not found" eyebrow="Safe recovery">
      <p className="panel-copy">This route is not part of the V1 shell. Return to Overview.</p>
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

function ListIcon() {
  return <RotateCw size={18} aria-hidden="true" />;
}

function routeTitle(route: AppRoute) {
  switch (route) {
    case "overview":
      return "Overview";
    case "ledger":
      return "Ledger";
    case "capture":
      return "Capture";
    case "meals":
      return "Meals";
    case "imports":
      return "Imports";
    case "settings":
      return "Settings";
    default:
      return "Unknown route";
  }
}

function syncLabel(state: SyncState) {
  switch (state) {
    case "synced":
      return "Synced";
    case "syncing":
      return "Syncing";
    case "failed":
      return "Sync failed";
    case "local-only":
      return "Local-only data";
  }
}

function syncDetail(state: SyncState) {
  switch (state) {
    case "synced":
      return "No pending local changes in this mock state.";
    case "syncing":
      return "Uploads and drafts would be queued behind this state.";
    case "failed":
      return "The user should get retry and manual-entry options.";
    case "local-only":
      return "Some data is not backed up to the cloud yet.";
  }
}
