import { useEffect, useState } from "react";
import {
  Banknote,
  Camera,
  FileDown,
  Home,
  LogIn,
  LogOut,
  ReceiptText,
  Settings,
  Utensils,
} from "lucide-react";
import type { AppRoute, AuthState, NavItem } from "./types";

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

  useEffect(() => {
    const handlePopState = () => setRoute(routeFromLocation());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (item: NavItem) => {
    window.history.pushState(null, "", item.path);
    setRoute(item.route);
  };

  if (authState !== "signed-in") {
    return (
      <main className="signed-out-shell">
        <section className="signed-out-panel">
          <div className="brand">
            <div className="brand-mark">
              <ReceiptText size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="brand-name">MealLedger</p>
              <p className="brand-caption">Accounting-first personal records</p>
            </div>
          </div>
          <div>
            <p className="eyebrow">Signed-out state</p>
            <h1>V1 app shell</h1>
            <p className="lede">Supabase Auth will connect later; this preview stays local.</p>
          </div>
          <button className="primary-action" type="button" onClick={() => setAuthState("signed-in")}>
            <LogIn size={18} aria-hidden="true" />
            Preview signed-in shell
          </button>
        </section>
      </main>
    );
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
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">V1 app shell</p>
            <h1>{routeTitle(route)}</h1>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Show signed-out state"
            onClick={() => setAuthState("signed-out")}
          >
            <LogOut size={18} aria-hidden="true" />
          </button>
        </header>

        <article className="panel">
          <p className="eyebrow">Route placeholder</p>
          <h2>{routeTitle(route)}</h2>
          <p className="panel-copy">
            This route is wired into the shell. Feature-specific empty states land separately.
          </p>
        </article>
      </section>
    </main>
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
