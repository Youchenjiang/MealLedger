import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { DependencyList, Dispatch, EffectCallback, ReactNode, SetStateAction } from "react";
import type { AuthState } from "../types";
import { isLocalDevelopmentMode, supabase } from "../lib/supabase";
import { sendMagicLink } from "./authActions";

type AuthContextValue = {
  state: AuthState;
  userId: string;
  email: string;
  message: string;
  configurationError: boolean;
  signIn: (email?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Authentication failed. Try again.";
}

const configurationError = !isLocalDevelopmentMode && !supabase;
const configurationMessage = "Cloud authentication is not configured for this deployment.";

function useStableEffect(effect: EffectCallback, dependencies: DependencyList): void {
  useEffect(effect, dependencies);
}

type SessionLike = { user?: { id?: string } } | null;

function initialAuthState(): AuthState {
  if (isLocalDevelopmentMode) {
    return "signed-out";
  }
  return configurationError ? "auth-error" : "loading";
}

function applySession(
  session: SessionLike,
  setUserId: Dispatch<SetStateAction<string>>,
  setState: Dispatch<SetStateAction<AuthState>>,
): void {
  setUserId(session?.user?.id ?? "");
  setState(session ? "signed-in" : "signed-out");
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [state, setState] = useState<AuthState>(initialAuthState);
  const [userId, setUserId] = useState(isLocalDevelopmentMode ? "local-user" : "");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(configurationError ? configurationMessage : "");

  useStableEffect(function initializeAuth() {
    if (isLocalDevelopmentMode || !supabase) {
      return undefined;
    }

    let mounted = true;
    const handleSession = (session: SessionLike): void => {
      if (!mounted) return;
      applySession(session, setUserId, setState);
    };

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        if (mounted) {
          setState("auth-error");
          setMessage(errorMessage(error));
        }
        return;
      }
      handleSession(data.session);
    });

    const authStateChange = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    function cleanupAuthSubscription(): void {
      mounted = false;
      authStateChange.data.subscription.unsubscribe();
    }
    return cleanupAuthSubscription;
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    state,
    userId,
    email,
    message,
    configurationError,
    signIn: async (requestedEmail = "") => {
      const normalizedEmail = requestedEmail.trim();
      setEmail(normalizedEmail);
      setMessage("");

      if (isLocalDevelopmentMode) {
        setUserId("local-user");
        setState("signed-in");
        return;
      }

      if (!supabase) {
        setState("auth-error");
        setMessage(configurationMessage);
        return;
      }

      setState("loading");
      const result = await sendMagicLink(supabase, normalizedEmail, window.location.origin);
      if (!result.ok) {
        setState("auth-error");
        setMessage(result.message);
        return;
      }

      setState("signed-out");
      setMessage("Magic link sent. Check your email to open the workspace.");
    },
    signOut: async () => {
      if (isLocalDevelopmentMode) {
        setUserId("local-user");
        setState("signed-out");
        return;
      }

      if (!supabase) {
        setState("auth-error");
        setMessage(configurationMessage);
        return;
      }

      const { error } = await supabase.auth.signOut();
      if (error) {
        setState("auth-error");
        setMessage(errorMessage(error));
        return;
      }
      setUserId("");
      setState("signed-out");
    },
  }), [email, message, state, userId]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
