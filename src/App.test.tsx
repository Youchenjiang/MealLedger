import { render, screen, within } from "@testing-library/react";
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
});
