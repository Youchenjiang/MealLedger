import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { DependencyList, Dispatch, EffectCallback, ReactNode, SetStateAction } from "react";
import type { AuthState } from "../types";
import { isLocalDevelopmentMode, supabase } from "../lib/supabase";
import { requestPasswordReset, restoreOAuthCallbackSession, signInWithOAuth, signInWithPassword, signUpWithPassword, updatePassword, type OAuthProvider } from "./authActions";

type AuthContextValue = {
  state: AuthState;
  userId: string;
  email: string;
  message: string;
  configurationError: boolean;
  signIn: (email?: string, password?: string) => Promise<void>;
  signUp: (email?: string, password?: string) => Promise<void>;
  requestPasswordReset: (email?: string) => Promise<void>;
  updatePassword: (password?: string) => Promise<void>;
  signInWithOAuth: (provider: OAuthProvider) => Promise<void>;
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

function authRedirect(): string {
  return `${window.location.origin}/account`;
}

function clearAuthCallbackHash(): void {
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [state, setState] = useState<AuthState>(initialAuthState);
  const [userId, setUserId] = useState(isLocalDevelopmentMode ? "local-user" : "");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(configurationError ? configurationMessage : "");

  useStableEffect(() => {
    if (isLocalDevelopmentMode || !supabase) {
      return () => undefined;
    }

    const client = supabase;
    let mounted = true;
    const handleSession = (event: string, session: SessionLike): void => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" && session) {
        setUserId(session.user?.id ?? "");
        setState("password-recovery");
        return;
      }
      applySession(session, setUserId, setState);
    };

    const restoreSession = async (): Promise<void> => {
      const callback = await restoreOAuthCallbackSession(client, window.location.href);
      if (callback.handled) {
        clearAuthCallbackHash();
        if (callback.result.ok) {
          handleSession("SIGNED_IN", callback.result.session);
        } else if (mounted) {
          setState("auth-error");
          setMessage(callback.result.message);
        }
        return;
      }

      const { data, error } = await client.auth.getSession();
      if (error) {
        if (mounted) {
          setState("auth-error");
          setMessage(errorMessage(error));
        }
        return;
      }
      handleSession("INITIAL_SESSION", data.session);
    };
    restoreSession().catch((error: unknown) => {
      if (mounted) {
        setState("auth-error");
        setMessage(errorMessage(error));
      }
    });

    const authStateChange = client.auth.onAuthStateChange((event, session) => {
      handleSession(event, session);
    });

    const cleanupAuthSubscription = (): void => {
      mounted = false;
      authStateChange.data.subscription.unsubscribe();
    };
    return cleanupAuthSubscription;
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    state,
    userId,
    email,
    message,
    configurationError,
    signIn: async (requestedEmail = "", password = "") => {
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
      const result = await signInWithPassword(supabase, normalizedEmail, password);
      if (!result.ok) {
        setState("auth-error");
        setMessage(result.message);
        return;
      }

      applySession(result.session, setUserId, setState);
      setMessage("");
    },
    signUp: async (requestedEmail = "", password = "") => {
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
      const result = await signUpWithPassword(supabase, normalizedEmail, password);
      if (!result.ok) {
        setState("auth-error");
        setMessage(result.message);
        return;
      }

      applySession(result.session, setUserId, setState);
      setMessage("");
    },
    requestPasswordReset: async (requestedEmail = "") => {
      const normalizedEmail = requestedEmail.trim();
      setEmail(normalizedEmail);
      setMessage("");
      if (isLocalDevelopmentMode) {
        setMessage("Password reset is available after cloud authentication is configured.");
        return;
      }
      if (!supabase) {
        setState("auth-error");
        setMessage(configurationMessage);
        return;
      }
      const result = await requestPasswordReset(supabase, normalizedEmail, authRedirect());
      setState(result.ok ? "signed-out" : "auth-error");
      setMessage(result.message);
    },
    updatePassword: async (password = "") => {
      if (!supabase) {
        setState("auth-error");
        setMessage(configurationMessage);
        return;
      }
      const result = await updatePassword(supabase, password);
      setState(result.ok ? "signed-in" : "password-recovery");
      setMessage(result.message);
    },
    signInWithOAuth: async (provider) => {
      setMessage("");
      if (isLocalDevelopmentMode) {
        setMessage(`${provider} sign-in is available after cloud authentication is configured.`);
        return;
      }
      if (!supabase) {
        setState("auth-error");
        setMessage(configurationMessage);
        return;
      }
      const result = await signInWithOAuth(supabase, provider, authRedirect());
      setState(result.ok ? "loading" : "auth-error");
      setMessage(result.message);
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
