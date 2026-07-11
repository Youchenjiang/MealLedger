import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { App } from "./App";

function renderWorkspace(path = "/") {
  window.history.pushState(null, "", path);
  render(<App />);
}

async function openWorkspace(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /open workspace/i }));
}

async function goToCapture(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Capture" }));
}

async function createExpenseDraft(user: ReturnType<typeof userEvent.setup>) {
  await user.clear(screen.getByLabelText("Merchant / source"));
  await user.type(screen.getByLabelText("Merchant / source"), "全聯");
  await user.clear(screen.getByLabelText("Amount"));
  await user.type(screen.getByLabelText("Amount"), "417");
  await user.click(screen.getByRole("button", { name: "Create draft" }));
}

describe("App shell draft flow", () => {
  beforeEach(() => {
    vi.stubGlobal("scrollTo", vi.fn());
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "draft-1"),
    });
    window.history.pushState(null, "", "/");
  });

  test("creates a manual expense draft and keeps confirmed ledger empty", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await goToCapture(user);
    await createExpenseDraft(user);

    expect(screen.getByText("Draft ready for review")).toBeInTheDocument();
    expect(screen.getByText("Latest: 全聯, TWD 417")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Review in Ledger" }));

    expect(screen.getByRole("heading", { name: "Ledger" })).toBeInTheDocument();
    const reviewQueue = screen.getByLabelText("Draft records waiting for review");
    expect(within(reviewQueue).getByRole("heading", { name: "Drafts waiting" })).toBeInTheDocument();
    expect(within(reviewQueue).getByText("全聯")).toBeInTheDocument();
    expect(within(reviewQueue).getByText("TWD 417")).toBeInTheDocument();
    expect(screen.getByText("No confirmed ledger records yet.")).toBeInTheDocument();
  });

  test("opens the workspace and navigates between core routes", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    expect(screen.getByRole("button", { name: /open workspace/i })).toBeInTheDocument();
    await openWorkspace(user);

    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();

    for (const route of ["Ledger", "Capture", "Settings", "Overview"]) {
      await user.click(screen.getByRole("button", { name: route }));
      expect(screen.getByRole("heading", { name: route })).toBeInTheDocument();
    }
  });

  test("recovers safely from an unknown route", async () => {
    const user = userEvent.setup();
    renderWorkspace("/missing");

    await openWorkspace(user);

    expect(screen.getByRole("heading", { name: "Unknown route" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /go to overview/i }));

    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
  });

  test("updates the status strip for offline and online events", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);

    act(() => window.dispatchEvent(new Event("offline")));
    expect(screen.getByText("Offline")).toBeInTheDocument();

    act(() => window.dispatchEvent(new Event("online")));
    expect(screen.getByText("Sync not enabled")).toBeInTheDocument();
  });

  test("shows draft counts as drafts are created", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    expect(screen.getByText("No drafts to review")).toBeInTheDocument();

    await goToCapture(user);
    await createExpenseDraft(user);

    expect(screen.getByText("1 draft waiting")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Overview" }));
    expect(screen.getByText("Draft reviews")).toBeInTheDocument();
    expect(screen.getByText("1 waiting")).toBeInTheDocument();
  });

  test("requires a transfer account before creating transfer drafts", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await goToCapture(user);
    await user.selectOptions(screen.getByLabelText("Type"), "transfer");

    await user.clear(screen.getByLabelText("Merchant / source"));
    await user.type(screen.getByLabelText("Merchant / source"), "小狗錢包");
    await user.clear(screen.getByLabelText("Amount"));
    await user.type(screen.getByLabelText("Amount"), "1000");
    await user.click(screen.getByRole("button", { name: "Create draft" }));

    expect(screen.queryByText("Draft ready for review")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Transfer account"), "郵局存款");
    await user.click(screen.getByRole("button", { name: "Create draft" }));

    expect(screen.getByText("Latest: 小狗錢包, TWD 1000 to 郵局存款")).toBeInTheDocument();
  });

  test("discards local drafts from the ledger review queue", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await goToCapture(user);
    await createExpenseDraft(user);
    await user.click(screen.getByRole("button", { name: "Review in Ledger" }));

    const reviewQueue = screen.getByLabelText("Draft records waiting for review");
    await user.click(within(reviewQueue).getByRole("button", { name: "Discard" }));

    expect(screen.queryByLabelText("Draft records waiting for review")).not.toBeInTheDocument();
    expect(screen.getByText("No confirmed ledger records yet.")).toBeInTheDocument();
    expect(screen.getByText("No drafts to review")).toBeInTheDocument();
  });

  test("labels unavailable capture paths as unavailable and keeps manual entry available", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await goToCapture(user);

    expect(screen.getByRole("link", { name: /record a transaction/i })).toHaveAttribute("href", "#manual-draft-form");
    expect(screen.getByRole("button", { name: /scan receipt or invoice/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /attach meal photo/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /attachment/i })).toBeDisabled();
  });

  test("offers every spec-one draft kind", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await goToCapture(user);

    const type = screen.getByLabelText("Type") as HTMLSelectElement;
    expect([...type.options].map((option) => option.value)).toEqual([
      "expense",
      "income",
      "transfer",
      "refund",
      "adjustment",
    ]);

    for (const kind of ["expense", "income", "transfer", "refund", "adjustment"]) {
      await user.selectOptions(type, kind);
      expect(type.value).toBe(kind);
    }
  });
});
