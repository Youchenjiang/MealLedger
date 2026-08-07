import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

type SupabaseAuthMock = {
  getSession: ReturnType<typeof vi.fn>;
  onAuthStateChange: ReturnType<typeof vi.fn>;
  signInWithPassword: ReturnType<typeof vi.fn>;
  signUp: ReturnType<typeof vi.fn>;
  resetPasswordForEmail: ReturnType<typeof vi.fn>;
  updateUser: ReturnType<typeof vi.fn>;
  signInWithOAuth: ReturnType<typeof vi.fn>;
  signOut: ReturnType<typeof vi.fn>;
};

async function renderAuthHarness(authMock?: SupabaseAuthMock) {
  vi.resetModules();
  vi.doMock("../lib/supabase", () => ({
    isLocalDevelopmentMode: !authMock,
    isSupabaseConfigured: Boolean(authMock),
    supabase: authMock ? { auth: authMock } : null,
  }));

  const { AuthProvider, useAuth } = await import("./AuthProvider");

  function AuthHarness({ children }: Readonly<{ children?: ReactNode }>) {
    const auth = useAuth();
    return (
      <div>
        <output aria-label="auth-state">{auth.state}</output>
        <output aria-label="auth-user">{auth.userId}</output>
        <output aria-label="auth-message">{auth.message}</output>
        <button type="button" onClick={() => { auth.signIn(" user@example.com ", "secret").catch(() => undefined); }}>Sign in</button>
        <button type="button" onClick={() => { auth.signUp(" new@example.com ", "secret").catch(() => undefined); }}>Create account</button>
        <button type="button" onClick={() => { auth.requestPasswordReset(" user@example.com ").catch(() => undefined); }}>Reset password</button>
        <button type="button" onClick={() => { auth.updatePassword("new-secret").catch(() => undefined); }}>Update password</button>
        <button type="button" onClick={() => { auth.signInWithOAuth("google").catch(() => undefined); }}>Google sign in</button>
        <button type="button" onClick={() => { auth.signOut().catch(() => undefined); }}>Sign out</button>
        {children}
      </div>
    );
  }

  return render(<AuthProvider><AuthHarness /></AuthProvider>);
}

function createAuthMock(session: unknown = null): SupabaseAuthMock {
  return {
    getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { session: { user: { id: "remote-user" } } }, error: null }),
    signUp: vi.fn().mockResolvedValue({ data: { session: { user: { id: "new-user" } } }, error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    updateUser: vi.fn().mockResolvedValue({ error: null }),
    signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  };
}

describe("auth provider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  test("supports local development sign in and sign out", async () => {
    const user = userEvent.setup();
    await renderAuthHarness();

    expect(screen.getByLabelText("auth-state")).toHaveTextContent("signed-out");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByLabelText("auth-state")).toHaveTextContent("signed-in");
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.getByLabelText("auth-state")).toHaveTextContent("signed-out");
  });

  test("uses a returned password session immediately", async () => {
    const user = userEvent.setup();
    const authMock = createAuthMock();
    await renderAuthHarness(authMock);

    await waitFor(() => expect(screen.getByLabelText("auth-state")).toHaveTextContent("signed-out"));
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(authMock.signInWithPassword).toHaveBeenCalledWith({ email: "user@example.com", password: "secret" });
    await waitFor(() => expect(screen.getByLabelText("auth-user")).toHaveTextContent("remote-user"));
    expect(screen.getByLabelText("auth-state")).toHaveTextContent("signed-in");
  });

  test("uses a returned sign-up session immediately", async () => {
    const user = userEvent.setup();
    const authMock = createAuthMock();
    await renderAuthHarness(authMock);

    await waitFor(() => expect(screen.getByLabelText("auth-state")).toHaveTextContent("signed-out"));
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(authMock.signUp).toHaveBeenCalledWith({ email: "new@example.com", password: "secret" });
    await waitFor(() => expect(screen.getByLabelText("auth-user")).toHaveTextContent("new-user"));
    expect(screen.getByLabelText("auth-state")).toHaveTextContent("signed-in");
  });

  test("returns to local-only when the provider sends an expired session", async () => {
    let authListener: (_event: string, session: unknown) => void = () => undefined;
    const authMock = createAuthMock({ user: { id: "remote-user" } });
    authMock.onAuthStateChange.mockImplementation((listener) => {
      authListener = listener;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    await renderAuthHarness(authMock);

    await waitFor(() => expect(screen.getByLabelText("auth-state")).toHaveTextContent("signed-in"));
    act(() => authListener("SIGNED_OUT", null));

    await waitFor(() => expect(screen.getByLabelText("auth-state")).toHaveTextContent("signed-out"));
    expect(screen.getByLabelText("auth-user")).toHaveTextContent("");
  });

  test("keeps a provider failure actionable", async () => {
    const user = userEvent.setup();
    const authMock = createAuthMock();
    authMock.signInWithPassword.mockResolvedValue({ data: null, error: new Error("invalid login") });
    await renderAuthHarness(authMock);

    await waitFor(() => expect(screen.getByLabelText("auth-state")).toHaveTextContent("signed-out"));
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(screen.getByLabelText("auth-state")).toHaveTextContent("auth-error"));
    expect(screen.getByLabelText("auth-message")).toHaveTextContent("invalid login");
  });

  test("uses the recovery session to update a password", async () => {
    let authListener: (_event: string, session: unknown) => void = () => undefined;
    const authMock = createAuthMock();
    authMock.onAuthStateChange.mockImplementation((listener) => {
      authListener = listener;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    const user = userEvent.setup();
    await renderAuthHarness(authMock);

    await waitFor(() => expect(screen.getByLabelText("auth-state")).toHaveTextContent("signed-out"));
    act(() => authListener("PASSWORD_RECOVERY", { user: { id: "remote-user" } }));
    await waitFor(() => expect(screen.getByLabelText("auth-state")).toHaveTextContent("password-recovery"));
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(authMock.updateUser).toHaveBeenCalledWith({ password: "new-secret" });
    await waitFor(() => expect(screen.getByLabelText("auth-state")).toHaveTextContent("signed-in"));
  });

  test("starts an OAuth redirect through the same provider", async () => {
    const user = userEvent.setup();
    const authMock = createAuthMock();
    await renderAuthHarness(authMock);

    await waitFor(() => expect(screen.getByLabelText("auth-state")).toHaveTextContent("signed-out"));
    await user.click(screen.getByRole("button", { name: "Google sign in" }));

    expect(authMock.signInWithOAuth).toHaveBeenCalledWith({ provider: "google", options: { redirectTo: `${window.location.origin}/settings` } });
    expect(screen.getByLabelText("auth-state")).toHaveTextContent("loading");
  });
});
