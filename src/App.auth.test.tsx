import { act, render, screen, within } from "@testing-library/react";
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
    linkIdentity: vi.fn().mockResolvedValue({ error: null }),
    unlinkIdentity: vi.fn().mockResolvedValue({ error: null }),
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

  test("opens the dedicated account route with password and provider sign-in", async () => {
    const user = userEvent.setup();
    const { authMock } = await renderRemoteApp();

    await user.click(screen.getByRole("button", { name: "Cloud & account" }));
    expect(screen.getByRole("heading", { name: "Cloud sync" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/account");
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Facebook" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Forgot password?" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(authMock.signInWithPassword).toHaveBeenCalledWith({ email: "user@example.com", password: "secret" });
    expect(await screen.findByRole("button", { name: "Confirm cloud handoff" })).toBeInTheDocument();
    expect(screen.getByLabelText("Local data handoff summary")).toBeInTheDocument();
  });

  test("confirms local data handoff from the dedicated account route", async () => {
    const user = userEvent.setup();
    await renderRemoteApp();

    await user.click(screen.getByRole("button", { name: "Cloud & account" }));
    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("button", { name: "Confirm cloud handoff" })).toBeInTheDocument();
    expect(screen.getByLabelText("Local data handoff summary")).toHaveTextContent("Accounts0Records0Drafts0Meals0Media0");

    await user.click(screen.getByRole("button", { name: "Confirm cloud handoff" }));
    expect(await screen.findByText("Cloud sync is enabled for this workspace.")).toBeInTheDocument();
  });

  test("links and unlinks provider identities from the signed-in account", async () => {
    const user = userEvent.setup();
    const authMock = createAuthMock();
    authMock.signInWithPassword = vi.fn().mockResolvedValue({
      data: {
        session: {
          user: {
            id: "remote-user",
            identities: [
              { id: "email-1", user_id: "remote-user", identity_id: "email-1", provider: "email" },
              { id: "google-1", user_id: "remote-user", identity_id: "google-1", provider: "google" },
            ],
          },
        },
      },
      error: null,
    });
    await renderRemoteApp(authMock);

    await user.click(screen.getByRole("button", { name: "Cloud & account" }));
    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(await screen.findByRole("button", { name: "Confirm cloud handoff" }));
    await screen.findByText("Cloud sync is enabled for this workspace.");

    const methods = screen.getByRole("group", { name: "Sign-in methods" });
    expect(within(methods).getByText("Email & password")).toBeInTheDocument();
    expect(within(methods).getByText("Primary")).toBeInTheDocument();
    expect(within(methods).getByRole("button", { name: "Unlink" })).toBeInTheDocument();
    expect(within(methods).getByRole("button", { name: "Link Facebook" })).toBeInTheDocument();

    await user.click(within(methods).getByRole("button", { name: "Unlink" }));
    expect(authMock.unlinkIdentity).toHaveBeenCalledWith({ id: "google-1", user_id: "remote-user", identity_id: "google-1", provider: "google" });

    await user.click(within(methods).getByRole("button", { name: "Link Facebook" }));
    expect(authMock.linkIdentity).toHaveBeenCalledWith({ provider: "facebook", options: { redirectTo: `${window.location.origin}/account` } });
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

    await user.click(screen.getByRole("button", { name: "Cloud & account" }));
    act(() => authListener("PASSWORD_RECOVERY", { user: { id: "remote-user" } }));

    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    await user.type(screen.getByLabelText("New password"), "new-secret");
    await user.click(screen.getByRole("button", { name: "Set new password" }));

    expect(authMock.updateUser).toHaveBeenCalledWith({ password: "new-secret" });
    expect(await screen.findByRole("button", { name: "Confirm cloud handoff" })).toBeInTheDocument();
  });

  test("reveals and masks the sign-in password with the visibility toggle", async () => {
    const user = userEvent.setup();
    await renderRemoteApp();

    await user.click(screen.getByRole("button", { name: "Cloud & account" }));

    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput).toHaveAttribute("type", "password");
    await user.type(passwordInput, "secret");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Password")).toHaveValue("secret");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Password")).toHaveValue("secret");
  });

  test("reveals and masks the new password field during recovery", async () => {
    const user = userEvent.setup();
    let authListener: (_event: string, session: unknown) => void = () => undefined;
    const authMock = createAuthMock();
    authMock.onAuthStateChange.mockImplementation((listener) => {
      authListener = listener;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    await renderRemoteApp(authMock);

    await user.click(screen.getByRole("button", { name: "Cloud & account" }));
    act(() => authListener("PASSWORD_RECOVERY", { user: { id: "remote-user" } }));

    const newPasswordInput = screen.getByLabelText("New password");
    expect(newPasswordInput).toHaveAttribute("type", "password");
    await user.type(newPasswordInput, "new-secret");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("New password")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("New password")).toHaveValue("new-secret");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(screen.getByLabelText("New password")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("New password")).toHaveValue("new-secret");
  });

  test("switches to a dedicated sign-up view and creates an account", async () => {
    const user = userEvent.setup();
    const { authMock } = await renderRemoteApp();
    authMock.signUp = vi.fn().mockResolvedValue({ data: { session: { user: { id: "new-user" } } }, error: null });

    await user.click(screen.getByRole("button", { name: "Cloud & account" }));
    await user.click(screen.getByRole("radio", { name: "Create account" }));

    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.type(screen.getByLabelText("Confirm password"), "secret");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(authMock.signUp).toHaveBeenCalledWith({ email: "new@example.com", password: "secret" });
  });

  test("rejects mismatched passwords before calling Supabase", async () => {
    const user = userEvent.setup();
    const { authMock } = await renderRemoteApp();

    await user.click(screen.getByRole("button", { name: "Cloud & account" }));
    await user.click(screen.getByRole("radio", { name: "Create account" }));
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.type(screen.getByLabelText("Confirm password"), "different");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match.");
    expect(authMock.signUp).not.toHaveBeenCalled();
  });

  test("opens a dedicated forgot-password view and sends the reset link", async () => {
    const user = userEvent.setup();
    const { authMock } = await renderRemoteApp();
    authMock.resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });

    await user.click(screen.getByRole("button", { name: "Cloud & account" }));
    await user.click(screen.getByRole("button", { name: "Forgot password?" }));

    expect(screen.getByRole("button", { name: "Send reset link" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(authMock.resetPasswordForEmail).toHaveBeenCalledWith("user@example.com", expect.anything());
    expect(await screen.findByText("Password reset link sent. Check your email.")).toBeInTheDocument();
  });
});
