export type PasswordAuthClient = {
  auth: {
    signInWithPassword: (options: { email: string; password: string }) => Promise<{ data: { session?: unknown } | null; error: unknown }>;
  };
};

export type PasswordAuthResult = { ok: true } | { ok: false; message: string };

export async function signInWithPassword(client: PasswordAuthClient, email: string, password: string): Promise<PasswordAuthResult> {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) {
    return { ok: false, message: "Email is required." };
  }
  if (!password.trim()) {
    return { ok: false, message: "Password is required." };
  }

  const { data, error } = await client.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Authentication failed. Try again." };
  }
  if (!data?.session) {
    return { ok: false, message: "Authentication did not return a workspace session." };
  }

  return { ok: true };
}
