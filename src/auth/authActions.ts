export type MagicLinkClient = {
  auth: {
    signInWithOtp: (options: { email: string; options: { emailRedirectTo: string } }) => Promise<{ error: unknown }>;
  };
};

export type MagicLinkResult = { ok: true } | { ok: false; message: string };

export async function sendMagicLink(client: MagicLinkClient, email: string, redirectTo: string): Promise<MagicLinkResult> {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) {
    return { ok: false, message: "Email is required." };
  }

  const { error } = await client.auth.signInWithOtp({
    email: normalizedEmail,
    options: { emailRedirectTo: redirectTo },
  });

  if (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Authentication failed. Try again." };
  }

  return { ok: true };
}
