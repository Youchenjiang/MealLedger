import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { App } from "./App";

function renderWorkspace(path = "/") {
  window.history.pushState(null, "", path);
  return render(<App />);
}

async function openWorkspace(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /open workspace/i }));
}

async function goToCapture(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Capture" }));
}

async function addAccount(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("button", { name: "Settings" }));
  await user.type(screen.getByLabelText("Account name"), name);
  await user.click(screen.getByRole("button", { name: "Add account" }));
}

async function createExpenseDraft(user: ReturnType<typeof userEvent.setup>) {
  await addAccount(user, "Daily wallet");
  await goToCapture(user);
  await user.selectOptions(screen.getByLabelText("Account"), "Daily wallet");
  await user.clear(screen.getByLabelText("Merchant"));
  await user.type(screen.getByLabelText("Merchant"), "全聯");
  await user.clear(screen.getByLabelText("Item name"));
  await user.type(screen.getByLabelText("Item name"), "香蕉");
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
    window.localStorage.clear();
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
      expect(screen.getByRole("button", { name: route })).toHaveAttribute("aria-current", "page");
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

  test("resolves supported nested routes without losing the shell route", async () => {
    const user = userEvent.setup();
    renderWorkspace("/ledger/draft/draft-42");

    await openWorkspace(user);
    expect(screen.getByRole("heading", { name: "Ledger" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Unknown route" })).not.toBeInTheDocument();

    window.history.pushState(null, "", "/settings/localization");
    act(() => window.dispatchEvent(new PopStateEvent("popstate")));
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
  });

  test("updates the status strip for offline and online events", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);

    act(() => window.dispatchEvent(new Event("offline")));
    expect(screen.getByText("Offline")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
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
    expect(screen.getByText("Local-only data")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Overview" }));
    expect(screen.getByText("Draft reviews")).toBeInTheDocument();
    expect(screen.getByText("1 waiting")).toBeInTheDocument();
  });

  test("requires a transfer account before creating transfer drafts", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await addAccount(user, "Daily wallet");
    await addAccount(user, "Savings");
    await goToCapture(user);
    await user.selectOptions(screen.getByLabelText("Type"), "transfer");
    await user.selectOptions(screen.getByLabelText("Source account"), "Daily wallet");
    await user.clear(screen.getByLabelText("Amount"));
    await user.type(screen.getByLabelText("Amount"), "1000");
    await user.click(screen.getByRole("button", { name: "Create draft" }));

    expect(screen.queryByText("Draft ready for review")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Merchant")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Source")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Destination account"), "Savings");
    await user.click(screen.getByRole("button", { name: "Create draft" }));

    expect(screen.getByText("Latest: Daily wallet 1000 TWD to Savings TWD")).toBeInTheDocument();
  });

  test("shows cross-currency and fee fields only for transfers", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await addAccount(user, "Daily wallet");
    await addAccount(user, "Japan cash");
    await goToCapture(user);
    await user.selectOptions(screen.getByLabelText("Type"), "transfer");
    await user.selectOptions(screen.getByLabelText("Transfer type"), "cross-currency");

    expect(screen.getByLabelText("Source account")).toBeInTheDocument();
    expect(screen.getByLabelText("Destination account")).toBeInTheDocument();
    expect(screen.getByLabelText("Source amount")).toBeInTheDocument();
    expect(screen.getByLabelText("Source currency")).toBeInTheDocument();
    expect(screen.getByLabelText("Destination amount")).toBeInTheDocument();
    expect(screen.getByLabelText("Destination currency")).toBeInTheDocument();
    expect(screen.queryByLabelText("Fee account")).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Add transfer fee" }));

    expect(screen.getByLabelText("Fee account")).toBeInTheDocument();
    expect(screen.getByLabelText("Fee amount")).toBeInTheDocument();
    expect(screen.getByLabelText("Fee currency")).toBeInTheDocument();
    expect(screen.getByLabelText("Fee category")).toBeInTheDocument();
    expect(screen.queryByLabelText("Merchant")).not.toBeInTheDocument();
  });

  test("requires local account setup before a capture account can be selected", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await goToCapture(user);

    expect(screen.getByLabelText("Account")).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Set up accounts" }));
    expect(screen.getByRole("heading", { name: "Accounts" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Account name"), "Travel cash");
    await user.click(screen.getByRole("button", { name: "Add account" }));
    expect(screen.getByLabelText("Available accounts")).toHaveTextContent("Travel cash");

    await goToCapture(user);
    expect(screen.getByLabelText("Account")).not.toBeDisabled();
    expect(screen.getByRole("option", { name: "Travel cash (TWD)" })).toBeInTheDocument();
  });

  test("uses native form validation to block incomplete manual drafts", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await goToCapture(user);

    const merchant = screen.getByLabelText("Merchant");
    const itemName = screen.getByLabelText("Item name");
    const amount = screen.getByLabelText("Amount");
    expect(merchant).toBeInvalid();
    expect(itemName).toBeInvalid();
    expect(amount).toBeInvalid();

    await user.click(screen.getByRole("button", { name: "Create draft" }));

    expect(screen.queryByText("Draft ready for review")).not.toBeInTheDocument();
  });

  test("shows a fallback error when draft validation rejects submission", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await goToCapture(user);

    const form = document.querySelector("form");
    if (!form) {
      throw new Error("Manual draft form was not rendered");
    }

    fireEvent.submit(form);

    expect(screen.getByRole("alert")).toHaveTextContent("Please fill in all required fields");
    expect(screen.queryByText("Draft ready for review")).not.toBeInTheDocument();
  });

  test("keeps local drafts after a reload", async () => {
    const user = userEvent.setup();
    const view = renderWorkspace();

    await openWorkspace(user);
    await goToCapture(user);
    await createExpenseDraft(user);

    view.unmount();
    renderWorkspace();
    await openWorkspace(user);
    await user.click(screen.getByRole("button", { name: "Ledger" }));
    expect(screen.getByText("全聯")).toBeInTheDocument();
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
    expect(screen.queryByText("Local-only data")).not.toBeInTheDocument();
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
      "fund-addition",
      "adjustment",
      "unresolved-expense",
    ]);

    for (const kind of ["expense", "income", "transfer", "refund", "fund-addition", "adjustment", "unresolved-expense"]) {
      await user.selectOptions(type, kind);
      expect(type.value).toBe(kind);
    }
  });

  test("switches to the required field language for each manual record kind", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await goToCapture(user);
    const type = screen.getByLabelText("Type");

    await user.selectOptions(type, "income");
    expect(screen.getByLabelText("Source")).toBeInTheDocument();
    expect(screen.queryByLabelText("Merchant")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Item name")).not.toBeInTheDocument();

    await user.selectOptions(type, "refund");
    expect(screen.getByLabelText("Merchant or source")).toBeInTheDocument();
    expect(screen.getByLabelText("Refund reason")).toBeInTheDocument();

    await user.selectOptions(type, "fund-addition");
    expect(screen.getByLabelText("Source")).toBeInTheDocument();
    expect(screen.queryByLabelText("Category")).not.toBeInTheDocument();

    await user.selectOptions(type, "adjustment");
    expect(screen.getByLabelText("Adjustment reason")).toBeInTheDocument();
    expect(screen.queryByLabelText("Merchant")).not.toBeInTheDocument();

    await user.selectOptions(type, "unresolved-expense");
    expect(screen.getByLabelText("Time precision")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Time precision"), "month");
    expect(screen.getByLabelText("Month")).toBeInTheDocument();
  });
});
