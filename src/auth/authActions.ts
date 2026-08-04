export type PasswordAuthClient = {
  auth: {
    signInWithPassword: (options: { email: string; password: string }) => Promise<{ data: { session?: PasswordSession } | null; error: unknown }>;
  };
};

export type PasswordRegistrationClient = {
  auth: {
    signUp: (options: { email: string; password: string }) => Promise<{ data: { session?: PasswordSession } | null; error: unknown }>;
  };
};

export type PasswordSession = { user?: { id?: string } } | null;
export type PasswordAuthResult = { ok: true; session: PasswordSession } | { ok: false; message: string };

function validatePasswordCredentials(email: string, password: string): PasswordAuthResult | null {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) {
    return { ok: false, message: "Email is required." };
  }
  if (!password.trim()) {
    return { ok: false, message: "Password is required." };
  }
  return null;
}

function authFailureMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Authentication failed. Try again.";
}

export async function signInWithPassword(client: PasswordAuthClient, email: string, password: string): Promise<PasswordAuthResult> {
  const invalid = validatePasswordCredentials(email, password);
  if (invalid) return invalid;

  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    return { ok: false, message: authFailureMessage(error) };
  }
  if (!data?.session) {
    return { ok: false, message: "Authentication did not return a workspace session." };
  }

  return { ok: true, session: data.session };
}

export async function signUpWithPassword(client: PasswordRegistrationClient, email: string, password: string): Promise<PasswordAuthResult> {
  const invalid = validatePasswordCredentials(email, password);
  if (invalid) return invalid;

  const { data, error } = await client.auth.signUp({ email: email.trim(), password });
  if (error) return { ok: false, message: authFailureMessage(error) };
  if (!data?.session) {
    return { ok: false, message: "Account created. Verify your email, then sign in to enable cloud sync." };
  }
  return { ok: true, session: data.session };
}
