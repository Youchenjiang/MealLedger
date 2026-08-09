import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AiLedgerPanel } from "./AiLedgerPanel";

vi.mock("./config", () => ({ isAiConfigured: () => true }));
vi.mock("./client", () => ({ requestAiJson: vi.fn() }));

import { requestAiJson } from "./client";

const accounts = [{ name: "Daily wallet", currency: "TWD" }];
const categories = ["午餐"];

beforeEach(() => {
  vi.mocked(requestAiJson).mockReset();
});

describe("AiLedgerPanel", () => {
  test("turns typed text into a confirmable draft and saves it", async () => {
    vi.mocked(requestAiJson).mockResolvedValue({
      ok: true,
      data: { items: [{ kind: "expense", date: "7/25", account: "Daily wallet", category: "午餐", counterparty: "麵店", itemName: "牛肉麵", amount: 480, currency: "TWD" }] },
    });
    const onSaveRecord = vi.fn(() => true);
    const user = userEvent.setup();

    render(<AiLedgerPanel accounts={accounts} categories={categories} onSaveRecord={onSaveRecord} onSaveDraft={vi.fn()} onApplyToForm={vi.fn()} />);

    await user.type(screen.getByLabelText("記帳內容"), "中午吃牛肉麵 480");
    await user.click(screen.getByRole("button", { name: /產生記帳草稿/u }));

    expect(await screen.findByRole("button", { name: "確認寫入" })).toBeInTheDocument();
    expect(screen.getByText(/TWD 480/u)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "確認寫入" }));

    expect(onSaveRecord).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/已確認/u)).toBeInTheDocument();
  });

  test("can move a suggestion into the draft queue instead", async () => {
    vi.mocked(requestAiJson).mockResolvedValue({
      ok: true,
      data: { items: [{ account: "Daily wallet", category: "午餐", amount: 90 }] },
    });
    const onSaveDraft = vi.fn();
    const user = userEvent.setup();

    render(<AiLedgerPanel accounts={accounts} categories={categories} onSaveRecord={vi.fn()} onSaveDraft={onSaveDraft} onApplyToForm={vi.fn()} />);

    await user.type(screen.getByLabelText("記帳內容"), "早餐 90");
    await user.click(screen.getByRole("button", { name: /產生記帳草稿/u }));

    await user.click(await screen.findByRole("button", { name: "存草稿" }));

    expect(onSaveDraft).toHaveBeenCalledTimes(1);
  });

  test("shows issues instead of confirm buttons for invalid suggestions", async () => {
    vi.mocked(requestAiJson).mockResolvedValue({
      ok: true,
      data: { items: [{ account: "消失的帳戶", amount: 100 }] },
    });
    const user = userEvent.setup();

    render(<AiLedgerPanel accounts={accounts} categories={categories} onSaveRecord={vi.fn()} onSaveDraft={vi.fn()} onApplyToForm={vi.fn()} />);

    await user.type(screen.getByLabelText("記帳內容"), "測試 100");
    await user.click(screen.getByRole("button", { name: /產生記帳草稿/u }));

    expect(await screen.findByText(/帳戶.*不存在/u)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "確認寫入" })).not.toBeInTheDocument();
  });

  test("lets the user prefill the ledger form when the account is missing", async () => {
    vi.mocked(requestAiJson).mockResolvedValue({
      ok: true,
      data: { items: [{ kind: "expense", date: "7/25", itemName: "牛肉麵", amount: 480 }] },
    });
    const onApplyToForm = vi.fn();
    const user = userEvent.setup();

    render(<AiLedgerPanel accounts={accounts} categories={categories} onSaveRecord={vi.fn()} onSaveDraft={vi.fn()} onApplyToForm={onApplyToForm} />);

    await user.type(screen.getByLabelText("記帳內容"), "7/25 牛肉麵 480");
    await user.click(screen.getByRole("button", { name: /產生記帳草稿/u }));

    const button = await screen.findByRole("button", { name: /填入表單/u });
    expect(button).toBeInTheDocument();

    await user.click(button);

    expect(onApplyToForm).toHaveBeenCalledTimes(1);
  });
});
