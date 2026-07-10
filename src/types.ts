import type { LucideIcon } from "lucide-react";

export type AppRoute =
  | "overview"
  | "ledger"
  | "capture"
  | "meals"
  | "imports"
  | "settings"
  | "not-found";

export type AuthState = "loading" | "signed-out" | "signed-in";

export type SyncState = "synced" | "syncing" | "local-only" | "failed";

export type NavItem = {
  route: Exclude<AppRoute, "not-found">;
  label: string;
  path: string;
  icon: LucideIcon;
};
