import type { LucideIcon } from "lucide-react";

export type AppRoute =
  | "overview"
  | "ledger"
  | "capture"
  | "settings"
  | "account"
  | "not-found";

export type AppLocation = {
  route: AppRoute;
  params: Readonly<Record<string, string>>;
};

export type AuthState = "loading" | "signed-out" | "signed-in" | "password-recovery" | "auth-error";

export type NavItem = {
  route: Exclude<AppRoute, "not-found">;
  label: string;
  path: string;
  icon: LucideIcon;
};
