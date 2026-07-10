import type { LucideIcon } from "lucide-react";

export type AppRoute =
  | "overview"
  | "ledger"
  | "capture"
  | "settings"
  | "not-found";

export type AuthState = "loading" | "signed-out" | "signed-in";

export type NavItem = {
  route: Exclude<AppRoute, "not-found">;
  label: string;
  path: string;
  icon: LucideIcon;
};
