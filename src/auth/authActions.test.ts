import { describe, expect, test, vi } from "vitest";
import { sendMagicLink } from "./authActions";

describe("magic link auth action", () => {
  test("rejects an empty email before calling Supabase", async () => {
    const signInWithOtp = vi.fn();
    const result = await sendMagicLink({ auth: { signInWithOtp } }, "  ", "https://example.test");

    expect(result).toEqual({ ok: false, message: "Email is required." });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  test("sends a normalized email and redirect URL", async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null });
    const result = await sendMagicLink({ auth: { signInWithOtp } }, " user@example.com ", "https://example.test");

    expect(result).toEqual({ ok: true });
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      options: { emailRedirectTo: "https://example.test" },
    });
  });

  test("returns the provider error without claiming success", async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ error: new Error("rate limited") });

    await expect(sendMagicLink({ auth: { signInWithOtp } }, "user@example.com", "https://example.test")).resolves.toEqual({
      ok: false,
      message: "rate limited",
    });
  });
});
