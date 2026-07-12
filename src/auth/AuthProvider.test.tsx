import { useAuth } from "./AuthProvider";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

function AuthHarness() {
  const auth = useAuth();
  return (
    <div>
      <output>{auth.state}</output>
      <button type="button" onClick={() => { void auth.signIn(); }}>Sign in</button>
      <button type="button" onClick={() => { void auth.signOut(); }}>Sign out</button>
    </div>
  );
}

describe("auth provider", () => {
  test("supports local development sign in and sign out", async () => {
    const user = userEvent.setup();
    const { AuthProvider } = await import("./AuthProvider");
    render(<AuthProvider><AuthHarness /></AuthProvider>);

    expect(screen.getByText("signed-out")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByText("signed-in")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.getByText("signed-out")).toBeInTheDocument();
  });
});
