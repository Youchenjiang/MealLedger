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

async function addAccount(user: ReturnType<typeof userEvent.setup>, name: string, currency = "TWD") {
  await user.click(screen.getByRole("button", { name: "Settings" }));
  await user.clear(screen.getByLabelText("Account name"));
  await user.selectOptions(screen.getByLabelText("Currency"), currency);
  await user.type(screen.getByLabelText("Account name"), name);
  await user.click(screen.getByRole("button", { name: "Add account" }));
}

async function createExpenseRecord(user: ReturnType<typeof userEvent.setup>) {
  await addAccount(user, "Daily wallet");
  await goToCapture(user);
  await user.selectOptions(screen.getByLabelText("Account"), "Daily wallet");
  await user.selectOptions(screen.getByLabelText("Category"), "Daily");
  await user.clear(screen.getByLabelText("Merchant"));
  await user.type(screen.getByLabelText("Merchant"), "全聯");
  await user.clear(screen.getByLabelText("Item name"));
  await user.type(screen.getByLabelText("Item name"), "香蕉");
  await user.clear(screen.getByLabelText("Amount"));
  await user.type(screen.getByLabelText("Amount"), "417");
  await user.click(screen.getByRole("button", { name: "Save record" }));
}

describe("App shell draft flow", () => {
  beforeEach(() => {
    let nextId = 0;
    vi.stubGlobal("scrollTo", vi.fn());
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => `local-${++nextId}`),
    });
    window.localStorage.clear();
    window.history.pushState(null, "", "/");
  });

  test("creates an official local expense record", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await goToCapture(user);
    await createExpenseRecord(user);

    expect(screen.getByText("Record saved to the local ledger.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open Ledger" }));

    expect(screen.getByRole("heading", { name: "Ledger" })).toBeInTheDocument();
    const recordList = screen.getByLabelText("Confirmed ledger records");
    expect(within(recordList).getByRole("heading", { name: "Ledger history" })).toBeInTheDocument();
    expect(within(recordList).getByText("全聯")).toBeInTheDocument();
    expect(within(recordList).getByText("TWD 417")).toBeInTheDocument();
    expect(screen.queryByText("No confirmed ledger records yet.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Overview" }));
    expect(screen.getByText("1 account")).toBeInTheDocument();
    expect(screen.getByText("Daily wallet: TWD -417")).toBeInTheDocument();
  });

  test("saves explicit fixed labels when expense details are unavailable", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await addAccount(user, "Daily wallet");
    await goToCapture(user);
    await user.selectOptions(screen.getByLabelText("Account"), "Daily wallet");
    await user.selectOptions(screen.getByLabelText("Category"), "Daily");
    await user.click(screen.getByRole("checkbox", { name: "Merchant unavailable" }));
    await user.click(screen.getByRole("checkbox", { name: "Item unavailable" }));
    await user.clear(screen.getByLabelText("Amount"));
    await user.type(screen.getByLabelText("Amount"), "80");
    await user.click(screen.getByRole("button", { name: "Save record" }));

    expect(screen.getByText("Record saved to the local ledger.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open Ledger" }));

    expect(screen.getByText("Merchant unavailable")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("mealledger.manual-ledger.records") ?? "[]")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          counterparty: "Merchant unavailable",
          counterpartyMissing: true,
          itemName: "Item unavailable",
          itemNameMissing: true,
        }),
      ]),
    );
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

  test("uses overview and ledger record entry actions", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await user.click(screen.getByRole("button", { name: "Start a record" }));
    expect(screen.getByRole("heading", { name: "Capture" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ledger" }));
    await user.click(screen.getByRole("button", { name: "Start a record" }));
    expect(screen.getByRole("heading", { name: "Capture" })).toBeInTheDocument();
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

  test("shows local record counts as records are created", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    expect(screen.getByText("No drafts to review")).toBeInTheDocument();

    await goToCapture(user);
    await createExpenseRecord(user);

    expect(screen.getByText("1 local record")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Overview" }));
    expect(screen.getByText("Ledger records")).toBeInTheDocument();
    expect(screen.getByText("1 saved")).toBeInTheDocument();
  });

  test("requires a transfer account before saving a transfer", async () => {
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
    await user.click(screen.getByRole("button", { name: "Save record" }));

    expect(screen.queryByText("Record saved to the local ledger.")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Merchant")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Source")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Destination account"), "Savings");
    await user.click(screen.getByRole("button", { name: "Save record" }));

    expect(screen.getByText("Record saved to the local ledger.")).toBeInTheDocument();
  });

  test("shows cross-currency and fee fields only for transfers", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await addAccount(user, "Daily wallet");
    await addAccount(user, "Japan cash");
    await goToCapture(user);
    await user.selectOptions(screen.getByLabelText("Type"), "transfer");
    await user.selectOptions(screen.getByLabelText("Source account"), "Daily wallet");
    await user.click(screen.getByRole("radio", { name: "Cross currency" }));

    expect(screen.getByLabelText("Source account")).toBeInTheDocument();
    expect(screen.getByLabelText("Destination account")).toBeInTheDocument();
    expect(screen.getByLabelText("Source amount")).toBeInTheDocument();
    expect(screen.getByText("Source currency")).toBeInTheDocument();
    expect(screen.getByLabelText("Destination amount")).toBeInTheDocument();
    expect(screen.getByText("Destination currency")).toBeInTheDocument();
    expect(screen.queryByLabelText("Fee account")).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Add transfer fee" }));

    expect(screen.getByLabelText("Fee account")).toBeInTheDocument();
    expect(screen.getByLabelText("Fee amount")).toBeInTheDocument();
    expect(screen.getByText("Fee currency")).toBeInTheDocument();
    expect(screen.getByLabelText("Fee category")).toBeInTheDocument();
    expect(screen.queryByLabelText("Merchant")).not.toBeInTheDocument();
  });

  test("derives record currencies from the selected accounts", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await addAccount(user, "Daily wallet");
    await addAccount(user, "Japan cash", "JPY");
    await goToCapture(user);
    await user.selectOptions(screen.getByLabelText("Account"), "Japan cash");

    expect(screen.getByText("JPY", { exact: true })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Type"), "transfer");
    await user.selectOptions(screen.getByLabelText("Source account"), "Daily wallet");
    expect(within(screen.getByLabelText("Destination account")).queryByRole("option", { name: "Japan cash (JPY)" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Cross currency" }));
    await user.selectOptions(screen.getByLabelText("Destination account"), "Japan cash");
    expect(screen.getByText("JPY", { exact: true })).toBeInTheDocument();
  });

  test("uses native radios for keyboard transfer switching", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await addAccount(user, "Daily wallet");
    await goToCapture(user);
    await user.selectOptions(screen.getByLabelText("Type"), "transfer");
    await user.selectOptions(screen.getByLabelText("Source account"), "Daily wallet");

    const sameCurrency = screen.getByRole("radio", { name: "Same currency" });
    sameCurrency.focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("radio", { name: "Cross currency" })).toBeChecked();
  });

  test("requires local account setup before a capture account can be selected", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await goToCapture(user);

    expect(screen.getByLabelText("Account")).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Add account" }));

    await user.type(screen.getByLabelText("New account name"), "Travel cash");
    await user.click(screen.getByRole("button", { name: "Add and select" }));

    expect(screen.getByLabelText("Account")).not.toBeDisabled();
    expect(screen.getByRole("option", { name: "Travel cash (TWD)" })).toBeInTheDocument();
    expect(screen.getByLabelText("Account")).toHaveValue("Travel cash");
  });

  test("offers practical quick amount adjustments", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await goToCapture(user);
    await user.click(screen.getByRole("button", { name: "Add account" }));
    await user.type(screen.getByLabelText("New account name"), "Daily wallet");
    await user.click(screen.getByRole("button", { name: "Add and select" }));

    const amount = screen.getByLabelText("Amount");
    await user.click(screen.getByRole("button", { name: "Increase Amount by 1000" }));
    await user.click(screen.getByRole("button", { name: "Increase Amount by 100" }));
    await user.click(screen.getByRole("button", { name: "Decrease Amount by 10" }));

    expect(amount).toHaveValue(1090);
  });

  test("shows an inline error when quick account setup is incomplete or duplicated", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await goToCapture(user);
    await user.click(screen.getByRole("button", { name: "Add account" }));
    await user.click(screen.getByRole("button", { name: "Add and select" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter an account name");

    await user.type(screen.getByLabelText("New account name"), "Daily wallet");
    await user.click(screen.getByRole("button", { name: "Add and select" }));
    await user.click(screen.getByRole("button", { name: "Add account" }));
    await user.type(screen.getByLabelText("New account name"), "daily wallet");
    await user.click(screen.getByRole("button", { name: "Add and select" }));

    expect(screen.getByRole("alert")).toHaveTextContent("already exists");
  });

  test("selects a seeded category or adds a local category", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await goToCapture(user);
    await user.click(screen.getByRole("button", { name: "Add account" }));
    await user.type(screen.getByLabelText("New account name"), "Daily wallet");
    await user.click(screen.getByRole("button", { name: "Add and select" }));

    const category = screen.getByLabelText("Category");
    await user.selectOptions(category, "AI");
    expect(category).toHaveValue("AI");

    await user.click(screen.getByRole("button", { name: "Add category" }));
    await user.type(screen.getByLabelText("New category name"), "Household");
    await user.click(screen.getByRole("button", { name: "Add and select" }));

    expect(category).toHaveValue("Household");
  });

  test("reports invalid categories and stores explicit unresolved time ranges", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await goToCapture(user);
    await user.click(screen.getByRole("button", { name: "Add account" }));
    await user.type(screen.getByLabelText("New account name"), "Daily wallet");
    await user.click(screen.getByRole("button", { name: "Add and select" }));

    await user.click(screen.getByRole("button", { name: "Add category" }));
    await user.click(screen.getByRole("button", { name: "Add and select" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a category name");
    await user.type(screen.getByLabelText("New category name"), "Daily");
    await user.click(screen.getByRole("button", { name: "Add and select" }));
    expect(screen.getByRole("alert")).toHaveTextContent("already exists");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await user.selectOptions(screen.getByLabelText("Type"), "unresolved-expense");
    await user.click(screen.getByRole("radio", { name: "Month" }));
    fireEvent.change(screen.getByLabelText("Month to record"), { target: { value: "2026-07" } });
    await user.click(screen.getByRole("radio", { name: "Period" }));
    fireEvent.change(screen.getByLabelText("Period start"), { target: { value: "2026-07-01" } });
    fireEvent.change(screen.getByLabelText("Period end"), { target: { value: "2026-07-31" } });
    await user.type(screen.getByLabelText("Amount"), "20");
    await user.click(screen.getByRole("button", { name: "Save record" }));

    expect(screen.getByText("Record saved to the local ledger.")).toBeInTheDocument();
  });

  test("supports inline transfer accounts and balance adjustments", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await goToCapture(user);
    await user.click(screen.getByRole("button", { name: "Add account" }));
    await user.type(screen.getByLabelText("New account name"), "Daily wallet");
    await user.click(screen.getByRole("button", { name: "Add and select" }));
    await user.selectOptions(screen.getByLabelText("Type"), "transfer");
    await user.click(screen.getByRole("button", { name: "Add destination account" }));
    await user.type(screen.getByLabelText("New account name"), "Japan cash");
    await user.selectOptions(screen.getByLabelText("Currency"), "JPY");
    await user.click(screen.getByRole("button", { name: "Add and select" }));
    await user.click(screen.getByRole("radio", { name: "Cross currency" }));
    await user.type(screen.getByLabelText("Source amount"), "1000");
    await user.type(screen.getByLabelText("Destination amount"), "46000");
    await user.click(screen.getByRole("checkbox", { name: "Add transfer fee" }));
    await user.click(screen.getByRole("button", { name: "Add fee account" }));
    await user.type(screen.getByLabelText("New account name"), "Fee wallet");
    await user.click(screen.getByRole("button", { name: "Add and select" }));
    await user.type(screen.getByLabelText("Fee amount"), "15");
    await user.type(screen.getByLabelText("Fee category"), "Fees");

    await user.selectOptions(screen.getByLabelText("Type"), "adjustment");
    await user.clear(screen.getByLabelText("Amount"));
    await user.type(screen.getByLabelText("Amount"), "-10");
    await user.type(screen.getByLabelText("Adjustment reason"), "Cash count");
    await user.click(screen.getByRole("button", { name: "Save record" }));

    expect(screen.getByText("Record saved to the local ledger.")).toBeInTheDocument();
  });

  test("keeps duplicate Settings accounts out of the local account list", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await addAccount(user, "Daily wallet");
    await addAccount(user, "daily wallet");

    expect(screen.getByLabelText("Available accounts").querySelectorAll("li")).toHaveLength(1);
  });

  test("uses native form validation to block incomplete manual records", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await goToCapture(user);

    await user.click(screen.getByRole("button", { name: "Add account" }));
    await user.type(screen.getByLabelText("New account name"), "Daily wallet");
    await user.click(screen.getByRole("button", { name: "Add and select" }));

    const merchant = screen.getByLabelText("Merchant");
    const itemName = screen.getByLabelText("Item name");
    const amount = screen.getByLabelText("Amount");
    expect(merchant).toBeInvalid();
    expect(itemName).toBeInvalid();
    expect(amount).toBeInvalid();
    await user.click(screen.getByRole("button", { name: "Save record" }));

    expect(screen.queryByText("Record saved to the local ledger.")).not.toBeInTheDocument();
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
    expect(screen.queryByText("Record saved to the local ledger.")).not.toBeInTheDocument();
  });

  test("keeps official local records after a reload", async () => {
    const user = userEvent.setup();
    const view = renderWorkspace();

    await openWorkspace(user);
    await goToCapture(user);
    await createExpenseRecord(user);

    view.unmount();
    renderWorkspace();
    await openWorkspace(user);
    await user.click(screen.getByRole("button", { name: "Ledger" }));
    expect(screen.getByLabelText("Confirmed ledger records")).toHaveTextContent("全聯");
  });

  test("keeps accounts available after a reload", async () => {
    const user = userEvent.setup();
    const view = renderWorkspace();

    await openWorkspace(user);
    await addAccount(user, "Daily wallet");

    view.unmount();
    renderWorkspace("/capture");
    await openWorkspace(user);

    expect(screen.getByRole("option", { name: "Daily wallet (TWD)" })).toBeInTheDocument();
  });

  test("edits and voids a local official record while retaining audit history", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("confirm", vi.fn(() => true));
    renderWorkspace();

    await openWorkspace(user);
    await createExpenseRecord(user);
    await user.click(screen.getByRole("button", { name: "Open Ledger" }));

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Amount"));
    await user.type(screen.getByLabelText("Amount"), "500");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByText("TWD 500")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Void" }));
    expect(screen.getByText("Voided")).toBeInTheDocument();

    const storedRecords = JSON.parse(window.localStorage.getItem("mealledger.manual-ledger.records") ?? "[]") as Array<{ recordState: string; version: number }>;
    const storedAuditEvents = JSON.parse(window.localStorage.getItem("mealledger.manual-ledger.audit-events") ?? "[]") as Array<{ eventType: string }>;
    expect(storedRecords[0]).toMatchObject({ recordState: "voided", version: 3 });
    expect(storedAuditEvents.map((event) => event.eventType)).toEqual(["record-created", "record-updated", "record-voided"]);
  });

  test("links a friend payback to an existing expense", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await createExpenseRecord(user);
    await user.selectOptions(screen.getByLabelText("Type"), "refund");
    await user.selectOptions(screen.getByLabelText("Category"), "Daily");
    await user.selectOptions(screen.getByLabelText("Refund type"), "payback");
    await user.selectOptions(screen.getByLabelText("Original expense"), "record-local-2");
    await user.clear(screen.getByLabelText("Merchant or source"));
    await user.type(screen.getByLabelText("Merchant or source"), "朋友");
    await user.clear(screen.getByLabelText("Amount"));
    await user.type(screen.getByLabelText("Amount"), "100");
    await user.type(screen.getByLabelText("Refund reason"), "朋友還款");
    await user.click(screen.getByRole("button", { name: "Save record" }));

    expect(screen.getByText("Record saved to the local ledger.")).toBeInTheDocument();
    const storedRecords = JSON.parse(window.localStorage.getItem("mealledger.manual-ledger.records") ?? "[]") as Array<{ kind: string; refundSubtype: string; refundLinkedRecordId: string }>;
    expect(storedRecords).toHaveLength(2);
    expect(storedRecords[1]).toMatchObject({ kind: "refund", refundSubtype: "payback", refundLinkedRecordId: "record-local-2" });
  });

  test("blocks an excess payback until the excess is classified", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await createExpenseRecord(user);
    await user.selectOptions(screen.getByLabelText("Type"), "refund");
    await user.selectOptions(screen.getByLabelText("Category"), "Daily");
    await user.selectOptions(screen.getByLabelText("Refund type"), "payback");
    await user.selectOptions(screen.getByLabelText("Original expense"), "record-local-2");
    await user.clear(screen.getByLabelText("Merchant or source"));
    await user.type(screen.getByLabelText("Merchant or source"), "朋友");
    await user.clear(screen.getByLabelText("Amount"));
    await user.type(screen.getByLabelText("Amount"), "500");
    await user.type(screen.getByLabelText("Refund reason"), "朋友還款");
    await user.click(screen.getByRole("button", { name: "Save record" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Classify the amount above");
    await user.selectOptions(screen.getByRole("combobox", { name: "Excess amount handling" }), "income");
    await user.click(screen.getByRole("button", { name: "Save record" }));
    expect(screen.getByText("Record saved to the local ledger.")).toBeInTheDocument();
  });

  test("offers field-by-field history suggestions for merchant and item input", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await createExpenseRecord(user);

    await user.type(screen.getByLabelText("Merchant"), "全");
    const merchantSuggestions = screen.getByRole("region", { name: "Merchant history suggestions" });
    expect(merchantSuggestions).toHaveTextContent("全聯");
    await user.click(within(merchantSuggestions).getByRole("button", { name: "Use amount TWD 417" }));
    expect(screen.getByLabelText("Amount")).toHaveValue(417);
    await user.click(within(merchantSuggestions).getByRole("button", { name: "Use account Daily wallet" }));
    expect(screen.getByLabelText("Account")).toHaveValue("Daily wallet");
    await user.click(within(merchantSuggestions).getByRole("button", { name: "Clear merchant" }));
    expect(screen.getByLabelText("Merchant")).toHaveValue("");

    await user.type(screen.getByLabelText("Item name"), "香蕉");
    const itemSuggestions = screen.getByRole("region", { name: "Item history suggestions" });
    expect(itemSuggestions).toHaveTextContent("香蕉");
    await user.click(within(itemSuggestions).getByRole("button", { name: "Use merchant 全聯" }));
    expect(screen.getByLabelText("Merchant")).toHaveValue("全聯");
  });

  test("does not place official records in the draft review queue", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await goToCapture(user);
    await createExpenseRecord(user);
    await user.click(screen.getByRole("button", { name: "Open Ledger" }));

    expect(screen.queryByLabelText("Draft records waiting for review")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Confirmed ledger records")).toHaveTextContent("全聯");
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
    await user.click(screen.getByRole("button", { name: "Add account" }));
    await user.type(screen.getByLabelText("New account name"), "Daily wallet");
    await user.click(screen.getByRole("button", { name: "Add and select" }));
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
    expect(screen.getByRole("group", { name: "Time precision" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Month" }));
    expect(screen.getByLabelText("Month to record")).toBeInTheDocument();
  });
});
