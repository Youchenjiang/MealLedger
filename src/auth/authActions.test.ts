import { describe, expect, test, vi } from "vitest";
import { signInWithPassword } from "./authActions";

describe("password auth action", () => {
  test("rejects an empty email before calling Supabase", async () => {
    const signInWithPasswordMock = vi.fn();
    const result = await signInWithPassword({ auth: { signInWithPassword: signInWithPasswordMock } }, "  ", "password");

    expect(result).toEqual({ ok: false, message: "Email is required." });
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });

  test("rejects an empty password before calling Supabase", async () => {
    const signInWithPasswordMock = vi.fn();
    const result = await signInWithPassword({ auth: { signInWithPassword: signInWithPasswordMock } }, "user@example.com", "  ");

    expect(result).toEqual({ ok: false, message: "Password is required." });
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });

  test("sends normalized credentials", async () => {
    const signInWithPasswordMock = vi.fn().mockResolvedValue({ data: { session: {} }, error: null });
    const result = await signInWithPassword({ auth: { signInWithPassword: signInWithPasswordMock } }, " user@example.com ", "secret");

    expect(result).toEqual({ ok: true });
    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "secret",
    });
  });

  test("returns the provider error without claiming success", async () => {
    const signInWithPasswordMock = vi.fn().mockResolvedValue({ data: null, error: new Error("invalid login") });

    await expect(signInWithPassword({ auth: { signInWithPassword: signInWithPasswordMock } }, "user@example.com", "secret")).resolves.toEqual({ ok: false, message: "invalid login" });
  });

  test("rejects a successful provider response without a session", async () => {
    const signInWithPasswordMock = vi.fn().mockResolvedValue({ data: {}, error: null });

    await expect(signInWithPassword({ auth: { signInWithPassword: signInWithPasswordMock } }, "user@example.com", "secret")).resolves.toEqual({
      ok: false,
      message: "Authentication did not return a workspace session.",
    });
  });
});
