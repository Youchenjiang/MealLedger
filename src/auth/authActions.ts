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

export type PasswordResetClient = {
  auth: {
    resetPasswordForEmail: (email: string, options: { redirectTo: string }) => Promise<{ error: unknown }>;
    updateUser: (attributes: { password: string }) => Promise<{ error: unknown }>;
  };
};

export type OAuthProvider = "google" | "facebook";

export type OAuthClient = {
  auth: {
    signInWithOAuth: (options: { provider: OAuthProvider; options: { redirectTo: string } }) => Promise<{ error: unknown }>;
  };
};

export type OAuthCallbackClient = {
  auth: {
    setSession: (session: { access_token: string; refresh_token: string }) => Promise<{ data: { session?: PasswordSession } | null; error: unknown }>;
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

export async function requestPasswordReset(client: PasswordResetClient, email: string, redirectTo: string): Promise<{ ok: boolean; message: string }> {
  if (!email.trim()) return { ok: false, message: "Email is required." };
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  return error
    ? { ok: false, message: authFailureMessage(error) }
    : { ok: true, message: "Password reset link sent. Check your email." };
}

export async function updatePassword(client: PasswordResetClient, password: string): Promise<{ ok: boolean; message: string }> {
  if (!password.trim()) return { ok: false, message: "Password is required." };
  const { error } = await client.auth.updateUser({ password });
  return error
    ? { ok: false, message: authFailureMessage(error) }
    : { ok: true, message: "Password updated. You can continue to cloud setup." };
}

export async function signInWithOAuth(client: OAuthClient, provider: OAuthProvider, redirectTo: string): Promise<{ ok: boolean; message: string }> {
  const { error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo } });
  return error
    ? { ok: false, message: authFailureMessage(error) }
    : { ok: true, message: `Opening ${provider} sign-in...` };
}

export async function restoreOAuthCallbackSession(client: OAuthCallbackClient, href: string): Promise<{ handled: false } | { handled: true; result: PasswordAuthResult }> {
  const params = new URLSearchParams(new URL(href).hash.slice(1));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return { handled: false };

  const { data, error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  if (error) return { handled: true, result: { ok: false, message: authFailureMessage(error) } };
  if (!data?.session) {
    return { handled: true, result: { ok: false, message: "Authentication did not return a workspace session." } };
  }
  return { handled: true, result: { ok: true, session: data.session } };
}
