import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createLocalAccount } from "../manualLedger/accounts";
import { ModeBPanel } from "./ModeBPanel";
import type { SpeechRecognitionLike } from "./speech";

vi.mock("./config", () => ({ isAiConfigured: vi.fn(() => true) }));
vi.mock("./client", () => ({ requestAiJson: vi.fn() }));

import { isAiConfigured } from "./config";
import { requestAiJson } from "./client";

const accounts = [{ name: "Daily wallet", currency: "TWD" }];
const categories = ["午餐"];

// A fake Web Speech API implementation that emits one transcript per start,
// so the panel's per-field capture path is exercised without a browser. The
// class is stubbed on the global, so the transcript is read from a mutable
// holder at start time.
let nextTranscript = "";

class FakeRecognition implements SpeechRecognitionLike {
  lang = "zh-TW";
  interimResults = false;
  onresult: SpeechRecognitionLike["onresult"] = null;
  onend: SpeechRecognitionLike["onend"] = null;
  onerror: SpeechRecognitionLike["onerror"] = null;
  start() {
    this.onresult?.({ results: [[{ transcript: nextTranscript }]] });
    this.onend?.();
  }
  stop() {}
}

beforeEach(() => {
  vi.mocked(requestAiJson).mockReset();
  vi.mocked(isAiConfigured).mockReturnValue(true);
  nextTranscript = "";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ModeBPanel", () => {
  test("walks the fields step by step and saves the assembled draft", async () => {
    const onSaveRecord = vi.fn((_draft: unknown, _extra?: unknown[]) => true);
    const user = userEvent.setup();
    render(<ModeBPanel accounts={accounts} categories={categories} onSaveRecord={onSaveRecord} />);

    const fill = async (label: string, value: string) => {
      await user.type(screen.getByLabelText(label), value);
      await user.click(screen.getByRole("button", { name: "填入此欄" }));
    };

    await fill("日期", "2026-07-25");
    await fill("類型", "expense");
    await fill("帳戶", "Daily wallet");
    await fill("類別", "午餐");
    await fill("對象", "麵店");
    await fill("品項", "牛肉麵");
    await fill("金額", "480");

    expect(screen.getByText("確認這筆記錄")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "確認存檔" }));

    expect(onSaveRecord).toHaveBeenCalledTimes(1);
    const draft = onSaveRecord.mock.calls[0][0] as { amount: string; account: string; category: string };
    expect(draft.amount).toBe("480");
    expect(draft.account).toBe("Daily wallet");
    expect(draft.category).toBe("午餐");
  });

  test("corrects a spoken field through the per-field AI prompt", async () => {
    vi.mocked(requestAiJson).mockResolvedValue({ ok: true, data: { value: "2026-07-25" } });
    nextTranscript = "七月二十五";
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    const user = userEvent.setup();
    render(<ModeBPanel accounts={accounts} categories={categories} onSaveRecord={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "用說的" }));

    await waitFor(() => expect(screen.getByLabelText("日期")).toHaveValue("2026-07-25"));
    expect(screen.getByText("AI 校對結果:2026-07-25")).toBeInTheDocument();
    expect(requestAiJson).toHaveBeenCalledWith(expect.objectContaining({ user: "七月二十五" }));
  });

  test("falls back to the raw transcript when AI is not configured", async () => {
    vi.mocked(isAiConfigured).mockReturnValue(false);
    nextTranscript = "2026-07-25";
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    const user = userEvent.setup();
    render(<ModeBPanel accounts={accounts} categories={categories} onSaveRecord={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "用說的" }));

    await waitFor(() => expect(screen.getByLabelText("日期")).toHaveValue("2026-07-25"));
    expect(requestAiJson).not.toHaveBeenCalled();
    expect(screen.getByText(/尚未設定 AI 金鑰/u)).toBeInTheDocument();
  });

  test("inserts a transfer destination step for transfers", async () => {
    const user = userEvent.setup();
    render(<ModeBPanel accounts={accounts} categories={categories} onSaveRecord={vi.fn()} />);

    await user.type(screen.getByLabelText("日期"), "2026-07-25");
    await user.click(screen.getByRole("button", { name: "填入此欄" }));
    await user.type(screen.getByLabelText("類型"), "transfer");
    await user.click(screen.getByRole("button", { name: "填入此欄" }));
    await user.type(screen.getByLabelText("帳戶"), "Daily wallet");
    await user.click(screen.getByRole("button", { name: "填入此欄" }));

    // The next step is the transfer destination; the category step is skipped.
    expect(screen.getByLabelText("轉帳目標")).toBeInTheDocument();
    expect(screen.queryByLabelText("類別")).not.toBeInTheDocument();
  });

  test("creates a new account on save under the auto policy", async () => {
    const createdAccount = createLocalAccount("新錢包", "TWD", "account-1");
    const onResolveNewEntities = vi.fn(() => (createdAccount ? [createdAccount] : []));
    const onSaveRecord = vi.fn(() => true);
    const user = userEvent.setup();
    render(
      <ModeBPanel
        accounts={accounts}
        categories={categories}
        entityPolicy={{ account: "auto", category: "existing" }}
        onResolveNewEntities={onResolveNewEntities}
        onSaveRecord={onSaveRecord}
      />,
    );

    const fill = async (label: string, value: string) => {
      await user.type(screen.getByLabelText(label), value);
      await user.click(screen.getByRole("button", { name: "填入此欄" }));
    };

    await fill("日期", "2026-07-25");
    await fill("類型", "expense");
    await fill("帳戶", "新錢包");
    await fill("類別", "午餐");
    await fill("對象", "麵店");
    await fill("品項", "牛肉麵");
    await fill("金額", "480");

    await user.click(screen.getByRole("button", { name: "確認存檔" }));

    expect(onResolveNewEntities).toHaveBeenCalledTimes(1);
    expect(onResolveNewEntities).toHaveBeenCalledWith(expect.objectContaining({ newAccount: "新錢包" }));
    expect(onSaveRecord).toHaveBeenCalledTimes(1);
  });
});
