import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { App } from "./App";

function renderWorkspace(path = "/") {
  window.history.pushState(null, "", path);
  return render(<App />);
}

function testLocalDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

async function openWorkspace(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /open workspace/i }));
  const skipSetup = screen.queryByRole("button", { name: "Browse workspace" });
  if (skipSetup) {
    await user.click(skipSetup);
  }
}

async function goToCapture(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Capture" }));
}

async function addCaptureAccount(user: ReturnType<typeof userEvent.setup>, name: string, currency = "TWD", trigger = "Add account") {
  const firstAccountButton = screen.queryByRole("button", { name: "Create first account" });
  if (firstAccountButton) {
    await user.click(firstAccountButton);
  } else {
    await user.click(screen.getByRole("button", { name: trigger }));
  }
  await user.type(screen.getByLabelText("Account name"), name);
  await user.selectOptions(screen.getByLabelText("Currency"), currency);
  await user.click(screen.getByRole("button", { name: "Add and select" }));
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

  test("guides a new workspace through first-account setup", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: /open workspace/i }));
    expect(screen.getByRole("heading", { name: "Set up your first account" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Account name"), "Travel wallet");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByText("1 account")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("mealledger.manual-ledger.custom-categories") ?? "[]")).toEqual(expect.arrayContaining(["飲食", "AI"]));
    expect(JSON.parse(window.localStorage.getItem("mealledger.taxonomy.tags") ?? "[]")).toEqual(expect.arrayContaining(["訂閱"]));
  });

  test("records an entered starting balance as fund addition", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: /open workspace/i }));
    await user.type(screen.getByLabelText("Account name"), "Bank account");
    await user.click(screen.getByRole("radio", { name: "Enter current balance" }));
    await user.type(screen.getByLabelText("Current balance"), "2500");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("1 saved")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("mealledger.manual-ledger.records") ?? "[]")).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "fund-addition", amount: "2500" })]),
    );
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

  test("switches between all capture intents without creating a ledger record", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await goToCapture(user);
    await user.click(screen.getByRole("button", { name: /Scan invoice/ }));
    expect(screen.getByRole("heading", { name: "Scan invoice" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save record" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Record meal/ }));
    expect(screen.getByRole("heading", { name: "Record meal" })).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("mealledger.manual-ledger.records") ?? "[]")).toEqual([]);

  });

  test("warns when browser storage cannot persist local changes", async () => {
    const user = userEvent.setup();
    const setItem = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("storage denied");
    });

    try {
      renderWorkspace();
      await openWorkspace(user);
      expect(await screen.findByLabelText(/Local storage unavailable/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Changes may be lost/)).toBeInTheDocument();
    } finally {
      setItem.mockRestore();
    }
  });

  test("saves a meal with multiple photos without creating a ledger record", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await goToCapture(user);
    await user.click(screen.getByRole("button", { name: /Record meal/ }));
    await user.upload(screen.getByLabelText("Meal photos"), [
      new File(["one"], "meal-1.jpg", { type: "image/jpeg" }),
      new File(["two"], "meal-2.jpg", { type: "image/jpeg" }),
    ]);
    await user.click(screen.getByRole("button", { name: "Save meal" }));

    expect(screen.getByText("Meal saved locally with 2 photos.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("mealledger.capture.meals") ?? "[]")).toEqual(
      [expect.objectContaining({ transactionIds: [], mediaAssetIds: [expect.stringContaining("meal-local-1-0-meal-1.jpg"), expect.stringContaining("meal-local-1-1-meal-2.jpg")] })],
    );
    expect(JSON.parse(window.localStorage.getItem("mealledger.capture.upload-queue") ?? "[]")).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: "queued", kind: "meal-photo", name: "meal-1.jpg" }), expect.objectContaining({ kind: "meal-photo", name: "meal-2.jpg" })]),
    );
    expect(JSON.parse(window.localStorage.getItem("mealledger.manual-ledger.records") ?? "[]")).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Overview" }));
    expect(screen.getByText(/Cloud sync incomplete|Local-only/)).toBeInTheDocument();
    expect(screen.getByText("2 local images")).toBeInTheDocument();
  });

  test("opens a real camera capture dialog for meal photos", async () => {
    const user = userEvent.setup();
    const stop = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) },
    });
    renderWorkspace();

    await openWorkspace(user);
    await goToCapture(user);
    await user.click(screen.getByRole("button", { name: /Record meal/ }));
    await user.click(screen.getByRole("button", { name: "Take photo" }));

    expect(await screen.findByRole("dialog", { name: "Take meal photo" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(stop).toHaveBeenCalledOnce();
  });

  test("keeps scanned sources separate from official ledger records", async () => {
    const user = userEvent.setup();
    const originalCreateObjectURL = window.URL.createObjectURL;
    const originalRevokeObjectURL = window.URL.revokeObjectURL;
    const createObjectURL = vi.fn(() => "blob:scan-preview");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(window.URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(window.URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    renderWorkspace();

    await openWorkspace(user);
    await goToCapture(user);
    await user.click(screen.getByRole("button", { name: /Scan receipt/ }));
    await user.upload(screen.getByLabelText("Scan images"), new File(["scan"], "receipt.jpg", { type: "image/jpeg" }));
    await user.click(screen.getByRole("button", { name: "Keep scan drafts" }));

    expect(screen.getByText("1 scan draft saved locally for review.")).toBeInTheDocument();
    expect(screen.getByText("receipt.jpg")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Preview of receipt.jpg" })).toHaveAttribute("src", "blob:scan-preview");
    expect(JSON.parse(window.localStorage.getItem("mealledger.manual-ledger.records") ?? "[]")).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Keep source" }));
    expect(screen.getByText("Kept for review")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("mealledger.capture.temporary-scans") ?? "[]")).toEqual(
      [expect.objectContaining({ state: "retained", expiresAt: null })],
    );

    await user.click(screen.getByRole("button", { name: "Remove source" }));
    expect(screen.queryByText("Kept for review")).not.toBeInTheDocument();
    expect(screen.queryByText("1 scan file queued locally for a future upload.")).not.toBeInTheDocument();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:scan-preview");
    expect(JSON.parse(window.localStorage.getItem("mealledger.capture.temporary-scans") ?? "[]")).toEqual(
      [expect.objectContaining({ state: "discarded" })],
    );
    Object.defineProperty(window.URL, "createObjectURL", { configurable: true, value: originalCreateObjectURL });
    Object.defineProperty(window.URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectURL });
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

  test("lets income sources be selected or added inline", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await addAccount(user, "Daily wallet");
    await goToCapture(user);
    await user.selectOptions(screen.getByLabelText("Account"), "Daily wallet");
    await user.selectOptions(screen.getByLabelText("Type"), "income");
    await user.selectOptions(screen.getByLabelText("Category"), "Allowance");
    await user.click(screen.getByRole("button", { name: "Add source" }));
    await user.type(screen.getByLabelText("New source"), "Parent");
    await user.click(screen.getByRole("button", { name: "Add and select" }));
    await user.clear(screen.getByLabelText("Amount", { exact: true }));
    await user.type(screen.getByLabelText("Amount", { exact: true }), "500");
    expect(screen.getByLabelText("Source")).toHaveValue("Parent");
    await user.click(screen.getByRole("button", { name: "Save record" }));
    await user.click(screen.getByRole("button", { name: "Open Ledger" }));

    expect(screen.getByText("Parent")).toBeInTheDocument();
  });

  test("exposes clean CSV, JSON, and ZIP exports from Settings", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => "blob:mealledger");
    const revokeObjectURL = vi.fn();
    const originalCreateObjectURL = window.URL.createObjectURL;
    const originalRevokeObjectURL = window.URL.revokeObjectURL;
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    Object.defineProperty(window.URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(window.URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    renderWorkspace();

    await openWorkspace(user);
    await user.click(screen.getByRole("button", { name: "Settings" }));

    await user.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(screen.getByText("CSV export downloaded. Image bytes were not included.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Export JSON" }));
    expect(screen.getByText("JSON export downloaded. Image bytes were not included.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Export ZIP" }));

    expect(createObjectURL).toHaveBeenCalledTimes(3);
    expect(revokeObjectURL).toHaveBeenCalledTimes(3);
    expect(anchorClick).toHaveBeenCalledTimes(3);
    anchorClick.mockRestore();
    Object.defineProperty(window.URL, "createObjectURL", { configurable: true, value: originalCreateObjectURL });
    Object.defineProperty(window.URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectURL });
  });

  test("validates a CSV selection without writing ledger records", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    const file = new File([`date,account,amount\n${testLocalDate()},Cash,417\n`], "ledger.csv", { type: "text/csv" });
    await user.upload(screen.getByLabelText("CSV import file"), file);

    expect(await screen.findByText("CSV ready for review: 1 rows and 3 columns. Mapped: date, account, amount. Rows ready: 0; review required: 1. No records were created.")).toBeInTheDocument();
    expect(window.localStorage.getItem("mealledger.manual-ledger.records")).toBe("[]");
  });

  test("confirms a valid CSV row into the local ledger through review", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await addAccount(user, "Daily wallet");
    const file = new File([
      `date,kind,account,amount,currency,merchant,item_name,category\n${testLocalDate()},expense,Daily wallet,417,TWD,全聯,香蕉,日用\n`,
    ], "ledger.csv", { type: "text/csv" });
    await user.upload(screen.getByLabelText("CSV import file"), file);

    await user.click(await screen.findByRole("button", { name: "Confirm import row 2" }));
    expect(screen.getByText("Imported row 2 into the local ledger.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ledger" }));

    expect(screen.getByText("全聯")).toBeInTheDocument();
    expect(screen.getByText("TWD 417")).toBeInTheDocument();
  });

  test("blocks a CSV row that duplicates an existing active ledger record", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await createExpenseRecord(user);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    const file = new File([
      `date,kind,account,amount,currency,merchant,item_name,category\n${testLocalDate()},expense,Daily wallet,417,TWD,全聯,香蕉,日用\n`,
    ], "duplicate.csv", { type: "text/csv" });
    await user.upload(screen.getByLabelText("CSV import file"), file);

    expect(await screen.findByText(/Duplicate candidate: record-/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm import row 2" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Skip row 2" })).toBeEnabled();
  });

  test("supports keeping a duplicate separate and linking another duplicate", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await createExpenseRecord(user);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    const file = new File([
      `date,kind,account,amount,currency,merchant,item_name,category\n${testLocalDate()},expense,Daily wallet,417,TWD,全聯,香蕉,日用\n${testLocalDate()},expense,Daily wallet,417,TWD,全聯,香蕉,日用\n`,
    ], "duplicate-actions.csv", { type: "text/csv" });
    await user.upload(screen.getByLabelText("CSV import file"), file);

    await user.click(await screen.findByRole("button", { name: "Keep separate row 2" }));
    await user.click(screen.getByRole("button", { name: "Link existing row 3" }));
    expect(screen.getByText("Status: kept-separate")).toBeInTheDocument();
    expect(screen.getByText("Status: linked")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ledger" }));
    expect(screen.getAllByText("全聯")).toHaveLength(2);
  });

  test("moves a duplicate into the persisted local draft queue", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await createExpenseRecord(user);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    const file = new File([
      `date,kind,account,amount,currency,merchant,item_name,category\n${testLocalDate()},expense,Daily wallet,417,TWD,全聯,香蕉,日用\n`,
    ], "duplicate-draft.csv", { type: "text/csv" });
    await user.upload(screen.getByLabelText("CSV import file"), file);

    await user.click(await screen.findByRole("button", { name: "Merge to draft row 2" }));
    await user.click(screen.getByRole("button", { name: "Ledger" }));
    expect(screen.getByText("1 local draft")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm to ledger" }));
    expect(screen.getByText("Draft confirmed in the local ledger.")).toBeInTheDocument();
    expect(screen.queryByText("1 local draft")).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("mealledger.manual-ledger.records") ?? "[]")).toHaveLength(2);
  });

  test("offers cancel choices and persists an incomplete manual entry as a local draft", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await addAccount(user, "Daily wallet");
    await goToCapture(user);
    await user.selectOptions(screen.getByLabelText("Account"), "Daily wallet");
    await user.type(screen.getByLabelText("Merchant"), "全聯");
    await user.click(screen.getByRole("button", { name: "Cancel entry" }));

    expect(screen.getByRole("dialog", { name: "Cancel entry" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue editing" }));
    expect(screen.queryByRole("dialog", { name: "Cancel entry" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Merchant")).toHaveValue("全聯");

    await user.click(screen.getByRole("button", { name: "Cancel entry" }));
    await user.click(screen.getByRole("button", { name: "Keep as draft" }));
    expect(screen.getByText("Entry cancelled.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("mealledger.app-shell.drafts") ?? "[]")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Ledger" }));
    expect(screen.getByText("1 local draft")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue in Capture" }));
    expect(screen.getByRole("heading", { name: "Capture" })).toBeInTheDocument();
    expect(screen.getByLabelText("Merchant")).toHaveValue("全聯");
    await user.selectOptions(screen.getByLabelText("Category"), "Daily");
    await user.type(screen.getByLabelText("Item name"), "香蕉");
    await user.clear(screen.getByLabelText("Amount"));
    await user.type(screen.getByLabelText("Amount"), "80");
    await user.click(screen.getByRole("button", { name: "Save record" }));
    expect(screen.getByText("Record saved to the local ledger.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("mealledger.app-shell.drafts") ?? "[]")).toHaveLength(0);
  });

  test("discarding a manual entry clears the changed form without creating a record", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await addAccount(user, "Daily wallet");
    await goToCapture(user);
    await user.selectOptions(screen.getByLabelText("Account"), "Daily wallet");
    await user.type(screen.getByLabelText("Merchant"), "全聯");
    await user.click(screen.getByRole("button", { name: "Cancel entry" }));
    await user.click(screen.getByRole("button", { name: "Discard changes" }));

    expect(screen.getByText("Entry cancelled.")).toBeInTheDocument();
    expect(screen.getByText("Select an account to continue")).toBeInTheDocument();
    expect(window.localStorage.getItem("mealledger.manual-ledger.records")).toBe("[]");
  });

  test("offers recurrence intent and keeps variable amounts out of auto-record", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("confirm", vi.fn(() => true));
    renderWorkspace();

    await openWorkspace(user);
    await addAccount(user, "Daily wallet");
    await goToCapture(user);
    await user.selectOptions(screen.getByLabelText("Account"), "Daily wallet");
    await user.selectOptions(screen.getByLabelText("Category"), "Daily");
    await user.type(screen.getByLabelText("Merchant", { exact: true }), "全聯");
    await user.type(screen.getByLabelText("Item name", { exact: true }), "香蕉");
    await user.clear(screen.getByLabelText("Amount", { exact: true }));
    await user.type(screen.getByLabelText("Amount", { exact: true }), "417");

    const recurrence = screen.getByLabelText("Record behavior");
    expect(within(recurrence).getByRole("option", { name: "Auto-record next cycle" })).toBeEnabled();

    await user.click(screen.getByRole("checkbox", { name: "Amount may vary next cycle" }));
    expect(within(recurrence).getByRole("option", { name: "Auto-record next cycle" })).toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: "Amount may vary next cycle" }));
    await user.selectOptions(recurrence, "auto-record-next-cycle");
    await user.click(screen.getByRole("button", { name: "Save record" }));
    await user.click(screen.getByRole("button", { name: "Open Ledger" }));

    expect(screen.getByRole("button", { name: "Pause recurring" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel recurring" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Pause recurring" }));
    expect(screen.getByRole("button", { name: "Resume recurring" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Resume recurring" }));
    await user.click(screen.getByRole("button", { name: "Cancel recurring" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(screen.queryByRole("button", { name: "Pause recurring" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel recurring" })).not.toBeInTheDocument();
  });

  test("converts an unresolved expense in place after completing its details", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await addAccount(user, "Daily wallet");
    await goToCapture(user);
    await user.selectOptions(screen.getByLabelText("Account"), "Daily wallet");
    await user.selectOptions(screen.getByLabelText("Type"), "unresolved-expense");
    await user.click(screen.getByRole("radio", { name: "Day" }));
    await user.clear(screen.getByLabelText("Date"));
    await user.type(screen.getByLabelText("Date"), "2026-07-12");
    await user.clear(screen.getByLabelText("Amount", { exact: true }));
    await user.type(screen.getByLabelText("Amount", { exact: true }), "80");
    await user.click(screen.getByRole("button", { name: "Save record" }));
    await user.click(screen.getByRole("button", { name: "Open Ledger" }));

    await user.click(screen.getByRole("button", { name: "Complete details" }));
    const editor = screen.getByRole("form", { name: "Complete unresolved-expense" });
    await user.clear(within(editor).getByLabelText("Date"));
    await user.type(within(editor).getByLabelText("Date"), "2026-07-12");
    await user.type(within(editor).getByLabelText("Category"), "Daily");
    await user.type(within(editor).getByLabelText("Merchant"), "Store");
    await user.type(within(editor).getByLabelText("Item name"), "Tea");
    await user.click(within(editor).getByRole("button", { name: "Convert to expense" }));

    expect(screen.getByText("Store")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Complete details" })).not.toBeInTheDocument();
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
    expect(screen.getByText("Local-only")).toBeInTheDocument();
  });

  test("keeps an offline manual record visibly local-only", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    act(() => window.dispatchEvent(new Event("offline")));
    await createExpenseRecord(user);

    expect(screen.getByText("Offline")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("mealledger.manual-ledger.records") ?? "[]")).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: "local-only", kind: "expense" })]),
    );

    await user.click(screen.getByRole("button", { name: "Open Ledger" }));
    expect(screen.getByLabelText("Confirmed ledger records")).toHaveTextContent("Local only");
  });

  test("rejects malformed CSV without touching the local ledger", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.upload(screen.getByLabelText("CSV import file"), new File(["unknown,other\nvalue\n"], "invalid.csv", { type: "text/csv" }));

    const rejectionMessage = await screen.findByText(/CSV rejected:/);
    expect(rejectionMessage).toHaveTextContent("CSV headers do not contain a supported ledger field.");
    expect(window.localStorage.getItem("mealledger.manual-ledger.records")).toBe("[]");
  });

  test("shows local record counts as records are created", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    expect(screen.getByText("No drafts to review")).toBeInTheDocument();

    await goToCapture(user);
    await createExpenseRecord(user);

    expect(screen.getByText(/1 record (synced|local-only)/)).toBeInTheDocument();

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
    await user.selectOptions(screen.getByLabelText("Account"), "Daily wallet");
    await user.selectOptions(screen.getByLabelText("Type"), "transfer");
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
    await user.selectOptions(screen.getByLabelText("Account"), "Daily wallet");
    await user.selectOptions(screen.getByLabelText("Type"), "transfer");
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

    await user.selectOptions(screen.getByLabelText("Account"), "Daily wallet");
    await user.selectOptions(screen.getByLabelText("Type"), "transfer");
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
    await user.selectOptions(screen.getByLabelText("Account"), "Daily wallet");
    await user.selectOptions(screen.getByLabelText("Type"), "transfer");

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

    expect(screen.getByText("Account required")).toBeInTheDocument();
    expect(screen.queryByText("Create an account before saving a ledger record.")).not.toBeInTheDocument();
    await addCaptureAccount(user, "Travel cash");

    expect(screen.getByLabelText("Account")).not.toBeDisabled();
    expect(screen.getByRole("option", { name: "Travel cash (TWD)" })).toBeInTheDocument();
    expect(screen.getByLabelText("Account")).toHaveValue("Travel cash");
  });

  test("records a quick-added account balance as initial funds", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await goToCapture(user);
    await user.click(screen.getByRole("button", { name: "Create first account" }));
    await user.type(screen.getByLabelText("Account name"), "Travel cash");
    expect(screen.getByRole("button", { name: "Increase Initial balance (optional) by 10" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Decrease Initial balance (optional) by 10" })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Initial balance (optional)"), "2500");
    fireEvent.change(screen.getByLabelText("Balance as of"), { target: { value: "2026-07-14" } });
    await user.click(screen.getByRole("button", { name: "Add and select" }));

    expect(screen.getByLabelText("Account")).toHaveValue("Travel cash");
    expect(JSON.parse(window.localStorage.getItem("mealledger.manual-ledger.records") ?? "[]")).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "fund-addition", accountName: "Travel cash", amount: "2500" })]),
    );
    expect(JSON.parse(window.localStorage.getItem("mealledger.manual-ledger.records") ?? "[]")).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "income", accountName: "Travel cash", amount: "2500" })]),
    );
  });

  test("allows a quick-added account to start from zero", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await goToCapture(user);
    await user.click(screen.getByRole("button", { name: "Create first account" }));
    await user.type(screen.getByLabelText("Account name"), "Empty wallet");
    await user.clear(screen.getByLabelText("Initial balance (optional)"));
    await user.type(screen.getByLabelText("Initial balance (optional)"), "0");

    expect(screen.queryByLabelText("Balance as of")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add and select" }));

    expect(screen.getByLabelText("Account")).toHaveValue("Empty wallet");
    expect(JSON.parse(window.localStorage.getItem("mealledger.manual-ledger.records") ?? "[]")).toEqual([]);
  });

  test("saves attachment photos without creating a meal or ledger record", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await goToCapture(user);
    await user.click(screen.getByRole("button", { name: /Attach photo/ }));
    await user.upload(screen.getByLabelText("Attachment photos"), [
      new File(["evidence"], "evidence-1.jpg", { type: "image/jpeg" }),
      new File(["evidence-2"], "evidence-2.jpg", { type: "image/jpeg" }),
    ]);
    await user.click(screen.getByRole("button", { name: "Clear selected" }));
    expect(screen.getByRole("button", { name: "Keep attachments" })).toBeDisabled();

    await user.upload(screen.getByLabelText("Attachment photos"), [
      new File(["evidence"], "evidence-1.jpg", { type: "image/jpeg" }),
      new File(["evidence-2"], "evidence-2.jpg", { type: "image/jpeg" }),
    ]);
    await user.click(screen.getByRole("button", { name: "Keep attachments" }));

    expect(screen.getByText("2 photos saved locally as attachment evidence.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("mealledger.capture.upload-queue") ?? "[]")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "attachment", name: "evidence-1.jpg" }),
        expect.objectContaining({ kind: "attachment", name: "evidence-2.jpg" }),
      ]),
    );
    expect(JSON.parse(window.localStorage.getItem("mealledger.capture.meals") ?? "[]")).toEqual([]);
    expect(JSON.parse(window.localStorage.getItem("mealledger.manual-ledger.records") ?? "[]")).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Clear pending attachments" }));
    expect(JSON.parse(window.localStorage.getItem("mealledger.capture.upload-queue") ?? "[]")).toEqual([]);
  });

  test("offers practical quick amount adjustments", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await goToCapture(user);
    await addCaptureAccount(user, "Daily wallet");

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
    await user.click(screen.getByRole("button", { name: "Create first account" }));
    await user.click(screen.getByRole("button", { name: "Add and select" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter an account name");

    await user.type(screen.getByLabelText("Account name"), "Daily wallet");
    await user.click(screen.getByRole("button", { name: "Add and select" }));
    await user.click(screen.getByRole("button", { name: "Add account" }));
    await user.type(screen.getByLabelText("Account name"), "daily wallet");
    await user.click(screen.getByRole("button", { name: "Add and select" }));

    expect(screen.getByRole("alert")).toHaveTextContent("already exists");
  });

  test("selects a seeded category or adds a local category", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await goToCapture(user);
    await addCaptureAccount(user, "Daily wallet");

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
    await addCaptureAccount(user, "Daily wallet");

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
    await addCaptureAccount(user, "Daily wallet");
    await user.selectOptions(screen.getByLabelText("Type"), "transfer");
    await user.click(screen.getByRole("button", { name: "Add destination account" }));
    await user.type(screen.getByLabelText("Account name"), "Japan cash");
    await user.selectOptions(screen.getByLabelText("Currency"), "JPY");
    await user.click(screen.getByRole("button", { name: "Add and select" }));
    await user.click(screen.getByRole("radio", { name: "Cross currency" }));
    await user.type(screen.getByLabelText("Source amount"), "1000");
    await user.type(screen.getByLabelText("Destination amount"), "46000");
    await user.click(screen.getByRole("checkbox", { name: "Add transfer fee" }));
    await user.click(screen.getByRole("button", { name: "Add fee account" }));
    await user.type(screen.getByLabelText("Account name"), "Fee wallet");
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

  test("records a Settings account current balance as initial funds", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.type(screen.getByLabelText("Account name"), "Savings");
    await user.selectOptions(screen.getByLabelText("Account type"), "bank");
    await user.click(screen.getByRole("radio", { name: "Enter current balance" }));
    await user.type(screen.getByLabelText("Current balance"), "2500");
    await user.click(screen.getByRole("button", { name: "Add account" }));

    expect(screen.getByLabelText("Available accounts")).toHaveTextContent("Savings");
    expect(JSON.parse(window.localStorage.getItem("mealledger.manual-ledger.records") ?? "[]")).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "fund-addition", accountName: "Savings", amount: "2500" })]),
    );
    expect(JSON.parse(window.localStorage.getItem("mealledger.manual-ledger.records") ?? "[]")).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "income", accountName: "Savings", amount: "2500" })]),
    );
  });

  test("uses native form validation to block incomplete manual records", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await goToCapture(user);

    await addCaptureAccount(user, "Daily wallet");

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
    await addCaptureAccount(user, "Daily wallet");

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
    await user.click(screen.getByRole("button", { name: "Confirm" }));
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

  test("requires an exchange-difference classification for a cross-currency payback", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await addAccount(user, "Japan cash", "JPY");
    await addAccount(user, "Taiwan wallet", "TWD");
    await goToCapture(user);

    await user.selectOptions(screen.getByLabelText("Account"), "Japan cash");
    await user.selectOptions(screen.getByLabelText("Category"), "Daily");
    await user.clear(screen.getByLabelText("Merchant"));
    await user.type(screen.getByLabelText("Merchant"), "Tokyo store");
    await user.clear(screen.getByLabelText("Item name"));
    await user.type(screen.getByLabelText("Item name"), "Travel item");
    await user.clear(screen.getByLabelText("Amount"));
    await user.type(screen.getByLabelText("Amount"), "1000");
    await user.click(screen.getByRole("button", { name: "Save record" }));

    const storedExpenses = JSON.parse(window.localStorage.getItem("mealledger.manual-ledger.records") ?? "[]") as Array<{ id: string }>;
    await user.selectOptions(screen.getByLabelText("Account"), "Taiwan wallet");
    await user.selectOptions(screen.getByLabelText("Type"), "refund");
    await user.selectOptions(screen.getByLabelText("Category"), "Daily");
    await user.selectOptions(screen.getByLabelText("Refund type"), "payback");
    await user.selectOptions(screen.getByLabelText("Original expense"), storedExpenses[0].id);
    await user.clear(screen.getByLabelText("Merchant or source"));
    await user.type(screen.getByLabelText("Merchant or source"), "朋友");
    await user.clear(screen.getByLabelText("Amount"));
    await user.type(screen.getByLabelText("Amount"), "30");
    await user.type(screen.getByLabelText("Refund reason"), "跨幣別還款");

    const differenceHandling = screen.getByRole("combobox", { name: "Currency difference handling" });
    expect(differenceHandling).toBeInTheDocument();
    await user.selectOptions(differenceHandling, "exchange_difference");
    await user.click(screen.getByRole("button", { name: "Save record" }));

    expect(screen.getByText("Record saved to the local ledger.")).toBeInTheDocument();
    const storedRecords = JSON.parse(window.localStorage.getItem("mealledger.manual-ledger.records") ?? "[]") as Array<{ refundExcessHandling?: string }>;
    expect(storedRecords[1]).toMatchObject({ refundExcessHandling: "exchange_difference" });
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

  test("offers separate capture intents and keeps manual entry selected by default", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await goToCapture(user);

    expect(screen.getByRole("button", { name: /Manual ledger/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Scan invoice/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Scan receipt/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Record meal/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Attach photo/ })).toBeEnabled();
  });

  test("offers every spec-one draft kind", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openWorkspace(user);
    await goToCapture(user);
    await addCaptureAccount(user, "Daily wallet");

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
    await addCaptureAccount(user, "Daily wallet");
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
