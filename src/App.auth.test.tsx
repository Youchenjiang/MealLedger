import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

function createAuthMock() {
  return {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { session: { user: { id: "remote-user" } } }, error: null }),
    signUp: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  };
}

async function renderRemoteApp(authMock = createAuthMock()) {
  vi.resetModules();
  vi.doMock("./lib/supabase", () => ({
    isLocalDevelopmentMode: false,
    isSupabaseConfigured: true,
    supabase: { auth: authMock },
  }));
  const { App } = await import("./App");
  return { authMock, view: render(<App />) };
}

describe("app auth boundary", () => {
  beforeEach(() => {
    vi.stubGlobal("scrollTo", vi.fn());
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "local-id") });
    window.localStorage.clear();
    window.history.pushState(null, "", "/");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  test("opens the local workspace without a sign-in gate", async () => {
    await renderRemoteApp();

    expect(await screen.findByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Set up your first account" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /open workspace/i })).not.toBeInTheDocument();
  });

  test("opens account settings from Settings with password and provider sign-in", async () => {
    const user = userEvent.setup();
    const { authMock } = await renderRemoteApp();

    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("tab", { name: "Account" }));
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Account settings" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/settings");
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Facebook" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Forgot password?" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(authMock.signInWithPassword).toHaveBeenCalledWith({ email: "user@example.com", password: "secret" });
    expect(await screen.findByRole("button", { name: "Confirm cloud handoff" })).toBeInTheDocument();
    expect(screen.getByLabelText("Local data handoff summary")).toBeInTheDocument();
  });

  test("confirms local data handoff from Settings account tab", async () => {
    const user = userEvent.setup();
    await renderRemoteApp();

    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("tab", { name: "Account" }));
    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("button", { name: "Confirm cloud handoff" })).toBeInTheDocument();
    expect(screen.getByLabelText("Local data handoff summary")).toHaveTextContent("Accounts0Records0Drafts0Meals0Media0");

    await user.click(screen.getByRole("button", { name: "Confirm cloud handoff" }));
    expect(await screen.findByText("Cloud sync is enabled for this workspace.")).toBeInTheDocument();
  });

  test("sets a new password from a recovery session", async () => {
    const user = userEvent.setup();
    let authListener: (_event: string, session: unknown) => void = () => undefined;
    const authMock = createAuthMock();
    authMock.updateUser = vi.fn().mockResolvedValue({ error: null });
    authMock.onAuthStateChange.mockImplementation((listener) => {
      authListener = listener;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    await renderRemoteApp(authMock);

    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("tab", { name: "Account" }));
    act(() => authListener("PASSWORD_RECOVERY", { user: { id: "remote-user" } }));

    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    await user.type(screen.getByLabelText("New password"), "new-secret");
    await user.click(screen.getByRole("button", { name: "Set new password" }));

    expect(authMock.updateUser).toHaveBeenCalledWith({ password: "new-secret" });
    expect(await screen.findByRole("button", { name: "Confirm cloud handoff" })).toBeInTheDocument();
  });
});
