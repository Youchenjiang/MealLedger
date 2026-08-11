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

  test("uses a guidance heading when every suggestion is invalid", async () => {
    vi.mocked(requestAiJson).mockResolvedValue({
      ok: true,
      data: { items: [{ account: "消失的帳戶", amount: 100 }] },
    });
    const user = userEvent.setup();

    render(<AiLedgerPanel accounts={accounts} categories={categories} onSaveRecord={vi.fn()} onSaveDraft={vi.fn()} onApplyToForm={vi.fn()} />);

    await user.type(screen.getByLabelText("記帳內容"), "測試 100");
    await user.click(screen.getByRole("button", { name: /產生記帳草稿/u }));

    expect(await screen.findByText(/項目有問題:可用「填入表單」補齊欄位/u)).toBeInTheDocument();
    expect(screen.queryByText("確認後寫入正式記錄")).not.toBeInTheDocument();
  });

  test("does not mislabel an unsupported kind as expense", async () => {
    vi.mocked(requestAiJson).mockResolvedValue({
      ok: true,
      data: { items: [{ kind: "refund", account: "Daily wallet", category: "午餐", amount: 100 }] },
    });
    const user = userEvent.setup();

    render(<AiLedgerPanel accounts={accounts} categories={categories} onSaveRecord={vi.fn()} onSaveDraft={vi.fn()} onApplyToForm={vi.fn()} />);

    await user.type(screen.getByLabelText("記帳內容"), "退款 100");
    await user.click(screen.getByRole("button", { name: /產生記帳草稿/u }));

    expect(await screen.findByText(/未知類型 · 無法辨識/u)).toBeInTheDocument();
    expect(screen.queryByText(/支出 · 無法辨識/u)).not.toBeInTheDocument();
  });

  test("shows what the model recognized even when the draft is rejected", async () => {
    vi.mocked(requestAiJson).mockResolvedValue({
      ok: true,
      data: { items: [{ kind: "expense", date: "7/25", counterparty: "同事", itemName: "便當", amount: 480 }] },
    });
    const user = userEvent.setup();

    render(<AiLedgerPanel accounts={accounts} categories={categories} onSaveRecord={vi.fn()} onSaveDraft={vi.fn()} onApplyToForm={vi.fn()} />);

    await user.type(screen.getByLabelText("記帳內容"), "7/25 中午和同事吃便當 480");
    await user.click(screen.getByRole("button", { name: /產生記帳草稿/u }));

    expect(await screen.findByText(/7\/25 · 同事 · 便當 · 480/u)).toBeInTheDocument();
    expect(screen.getByText(/欄位不完整/u)).toBeInTheDocument();
    expect(screen.getByText(/帳戶.*不存在/u)).toBeInTheDocument();
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

  test("offers the apply-to-form action for valid suggestions too", async () => {
    vi.mocked(requestAiJson).mockResolvedValue({
      ok: true,
      data: { items: [{ kind: "expense", account: "Daily wallet", category: "午餐", itemName: "牛肉麵", amount: 480 }] },
    });
    const onApplyToForm = vi.fn();
    const user = userEvent.setup();

    render(<AiLedgerPanel accounts={accounts} categories={categories} onSaveRecord={vi.fn()} onSaveDraft={vi.fn()} onApplyToForm={onApplyToForm} />);

    await user.type(screen.getByLabelText("記帳內容"), "牛肉麵 480");
    await user.click(screen.getByRole("button", { name: /產生記帳草稿/u }));

    const button = await screen.findByRole("button", { name: "填入表單" });
    expect(button).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "確認寫入" })).toBeInTheDocument();

    await user.click(button);

    expect(onApplyToForm).toHaveBeenCalledTimes(1);
  });

  test("shows the item name even when the model omits the counterparty", async () => {
    vi.mocked(requestAiJson).mockResolvedValue({
      ok: true,
      data: { items: [{ kind: "expense", date: "7/25", account: "Daily wallet", category: "午餐", itemName: "牛肉麵", amount: 480, currency: "TWD" }] },
    });
    const user = userEvent.setup();

    render(<AiLedgerPanel accounts={accounts} categories={categories} onSaveRecord={vi.fn()} onSaveDraft={vi.fn()} onApplyToForm={vi.fn()} />);

    await user.type(screen.getByLabelText("記帳內容"), "7/25 中午吃牛肉麵 480");
    await user.click(screen.getByRole("button", { name: /產生記帳草稿/u }));

    expect(await screen.findByRole("button", { name: "確認寫入" })).toBeInTheDocument();
    expect(screen.getByText(/品項:牛肉麵/u)).toBeInTheDocument();
    expect(screen.queryByText(/Merchant unavailable/u)).not.toBeInTheDocument();
  });

  test("creates a mentioned new account on confirm under the auto policy", async () => {
    vi.mocked(requestAiJson).mockResolvedValue({
      ok: true,
      data: { items: [{ kind: "expense", date: "7/25", account: "新錢包", category: "午餐", itemName: "牛肉麵", amount: 480 }] },
    });
    const autoPolicy = { account: "auto", category: "auto" } as const;
    const onResolveNewEntities = vi.fn(() => true);
    const onSaveRecord = vi.fn(() => true);
    const user = userEvent.setup();

    render(<AiLedgerPanel accounts={accounts} categories={categories} entityPolicy={autoPolicy} onResolveNewEntities={onResolveNewEntities} onSaveRecord={onSaveRecord} onSaveDraft={vi.fn()} onApplyToForm={vi.fn()} />);

    await user.type(screen.getByLabelText("記帳內容"), "新錢包 中午吃牛肉麵 480");
    await user.click(screen.getByRole("button", { name: /產生記帳草稿/u }));

    expect(await screen.findByRole("button", { name: "確認寫入" })).toBeInTheDocument();
    expect(screen.getByText("帳戶尚不存在")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "確認寫入" }));

    expect(onResolveNewEntities).toHaveBeenCalledTimes(1);
    expect(onResolveNewEntities).toHaveBeenCalledWith(expect.objectContaining({ newAccount: "新錢包" }));
    expect(onSaveRecord).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/已確認/u)).toBeInTheDocument();
  });

  test("asks before creating a new entity under the ask policy and writes on approval", async () => {
    vi.mocked(requestAiJson).mockResolvedValue({
      ok: true,
      data: { items: [{ kind: "expense", date: "7/25", account: "新錢包", category: "午餐", itemName: "牛肉麵", amount: 480 }] },
    });
    const askPolicy = { account: "ask", category: "ask" } as const;
    const onResolveNewEntities = vi.fn(() => true);
    const onSaveRecord = vi.fn(() => true);
    const user = userEvent.setup();

    render(<AiLedgerPanel accounts={accounts} categories={categories} entityPolicy={askPolicy} onResolveNewEntities={onResolveNewEntities} onSaveRecord={onSaveRecord} onSaveDraft={vi.fn()} onApplyToForm={vi.fn()} />);

    await user.type(screen.getByLabelText("記帳內容"), "新錢包 中午吃牛肉麵 480");
    await user.click(screen.getByRole("button", { name: /產生記帳草稿/u }));

    await user.click(await screen.findByRole("button", { name: "確認寫入" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/帳戶「新錢包」/u);
    expect(onSaveRecord).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "新增並寫入" }));

    expect(onResolveNewEntities).toHaveBeenCalledTimes(1);
    expect(onSaveRecord).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText(/已確認/u)).toBeInTheDocument();
  });

  test("keeps the suggestion unconfirmed when the ask dialog is cancelled", async () => {
    vi.mocked(requestAiJson).mockResolvedValue({
      ok: true,
      data: { items: [{ kind: "expense", date: "7/25", account: "新錢包", category: "午餐", itemName: "牛肉麵", amount: 480 }] },
    });
    const askPolicy = { account: "ask", category: "ask" } as const;
    const onResolveNewEntities = vi.fn(() => true);
    const onSaveRecord = vi.fn(() => true);
    const user = userEvent.setup();

    render(<AiLedgerPanel accounts={accounts} categories={categories} entityPolicy={askPolicy} onResolveNewEntities={onResolveNewEntities} onSaveRecord={onSaveRecord} onSaveDraft={vi.fn()} onApplyToForm={vi.fn()} />);

    await user.type(screen.getByLabelText("記帳內容"), "新錢包 中午吃牛肉麵 480");
    await user.click(screen.getByRole("button", { name: /產生記帳草稿/u }));

    await user.click(await screen.findByRole("button", { name: "確認寫入" }));
    await user.click(screen.getByRole("button", { name: "取消" }));

    expect(onSaveRecord).not.toHaveBeenCalled();
    expect(onResolveNewEntities).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "確認寫入" })).toBeInTheDocument();
  });

  test("marks inferred fields and leaves explicitly stated ones unmarked", async () => {
    vi.mocked(requestAiJson).mockResolvedValue({
      ok: true,
      data: { items: [{ kind: "expense", date: "7/25", account: "Daily wallet", category: "午餐", counterparty: "麵店", itemName: "牛肉麵", amount: 480, currency: "TWD", explicit: ["date", "counterparty", "itemName", "amount"] }] },
    });
    const user = userEvent.setup();

    render(<AiLedgerPanel accounts={accounts} categories={categories} onSaveRecord={vi.fn()} onSaveDraft={vi.fn()} onApplyToForm={vi.fn()} />);

    await user.type(screen.getByLabelText("記帳內容"), "7/25 中午吃牛肉麵 480");
    await user.click(screen.getByRole("button", { name: /產生記帳草稿/u }));

    const confirm = await screen.findByRole("button", { name: "確認寫入" });
    const card = confirm.closest("article");
    expect(card).not.toBeNull();

    const marked = Array.from(card!.querySelectorAll(".inferred-field"));
    // kind, currency, the derived year, account, and category were inferred.
    expect(marked.some((element) => element.textContent === "支出")).toBe(true);
    expect(marked.some((element) => element.textContent === "TWD")).toBe(true);
    expect(marked.some((element) => element.textContent === "2026")).toBe(true);
    expect(marked.some((element) => element.textContent === "Daily wallet")).toBe(true);
    expect(marked.some((element) => element.textContent === "午餐")).toBe(true);
    // The amount the user actually stated stays unmarked.
    expect(marked.every((element) => element.textContent !== "480")).toBe(true);
    // The card explains the marking.
    expect(screen.getByText(/底線欄位是 AI 推論/u)).toBeInTheDocument();
  });
});
