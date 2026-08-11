import { useEffect, useRef, useState } from "react";
import { ImagePlus, Mic, Sparkles } from "lucide-react";
import type { TransactionDraft } from "../appShell/drafts";
import { isAiConfigured } from "./config";
import { requestAiJson } from "./client";
import { buildLedgerSystemPrompt, buildUserPrompt } from "./prompt";
import { parseDraftSuggestions, type AiDraftSuggestion } from "./parse";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ReadonlyArray<ReadonlyArray<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function speechRecognition(): SpeechRecognitionCtor | null {
  const globalWindow = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return globalWindow.SpeechRecognition ?? globalWindow.webkitSpeechRecognition ?? null;
}

const kindLabel: Record<string, string> = {
  expense: "支出",
  income: "收入",
  transfer: "轉帳",
};

export type AiLedgerPanelProps = Readonly<{
  accounts: Array<{ name: string; currency: string }>;
  categories: string[];
  onSaveRecord: (draft: TransactionDraft) => boolean;
  onSaveDraft: (draft: TransactionDraft) => void;
  // Prefills the ledger form with the fields the AI could identify so the
  // user can complete the remaining ones (account, category, …) manually.
  onApplyToForm: (suggestion: AiDraftSuggestion) => void;
}>;

export function AiLedgerPanel({ accounts, categories, onSaveRecord, onSaveDraft, onApplyToForm }: AiLedgerPanelProps) {
  const [inputText, setInputText] = useState("");
  const [selectedImage, setSelectedImage] = useState<{ name: string; dataUrl: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AiDraftSuggestion[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const configured = isAiConfigured();
  const hasValidSuggestion = suggestions.some((item) => item.ok);

  // Stop any in-flight speech session when the panel unmounts so the
  // recognition instance and its callbacks do not outlive the component.
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!inputText.trim() && !selectedImage) {
      setError("請輸入或念出記帳內容,或選擇發票/收據照片。");
      return;
    }
    setLoading(true);
    try {
      // Compute once per submit so the system prompt and the parsed drafts
      // always agree on the reference date, even across midnight.
      const today = localToday();
      const system = buildLedgerSystemPrompt({ accounts, categories, today });
      const user = buildUserPrompt(inputText, selectedImage?.dataUrl);
      const result = await requestAiJson({ system, user, imageDataUrl: selectedImage?.dataUrl });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const parsed = parseDraftSuggestions(result.data, accounts, categories, today);
      setSuggestions(parsed);
      if (parsed.length === 0) {
        setError("AI 沒有辨識出任何交易,請換一種描述試試。");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelection = (file: File | undefined) => {
    setSelectedImage(null);
    setError("");
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      // readAsDataURL always resolves to a string; guard the union type.
      const result = reader.result;
      if (typeof result !== "string") return;
      // Downscale large photos so the request stays within the edge-function
      // body limit (base64 inflates ~33%). downscaleImage never rejects, so
      // the follow-up cannot fail silently.
      downscaleImage(result, 1600, 0.82).then((scaled) => {
        setSelectedImage({ name: file.name, dataUrl: scaled });
      });
    };
    reader.readAsDataURL(file);
  };

  const toggleListening = () => {
    const Ctor = speechRecognition();
    if (!Ctor) {
      setError("此瀏覽器不支援語音輸入,請改用文字或照片。");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new Ctor();
    recognition.lang = "zh-TW";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      let transcript = "";
      for (const result of event.results) {
        transcript += result[0].transcript;
      }
      setInputText((current) => `${current}${current ? " " : ""}${transcript}`.trim());
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setError("語音辨識失敗,請再試一次或改用文字輸入。");
    };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const confirmSuggestion = (suggestion: AiDraftSuggestion) => {
    if (!suggestion.draft) return;
    setError("");
    setMessage("");
    const saved = onSaveRecord(suggestion.draft);
    if (!saved) {
      setError("這筆記錄無法建立,請檢查帳戶與欄位後手動新增。");
      return;
    }
    setSuggestions((current) => current.filter((item) => item !== suggestion));
    setMessage("已確認並寫入正式記錄。");
  };

  const saveSuggestionAsDraft = (suggestion: AiDraftSuggestion) => {
    if (!suggestion.draft) return;
    onSaveDraft(suggestion.draft);
    setSuggestions((current) => current.filter((item) => item !== suggestion));
    setMessage("已存到草稿佇列,可到 Ledger 的 Review queue 繼續處理。");
  };

  return (
    <div className="ai-ledger-panel">
      <form className="ai-ledger-form" onSubmit={handleSubmit}>
        <p className="field-help">
          用說的、打字,或拍發票/收據,AI 會幫你把欄位填好,確認後才寫入正式記錄。
        </p>
        {!configured ? (
          <output className="inline-message">尚未設定 AI 金鑰:在 .env 設定 AI_PROVIDER 與 AI_API_KEY 後即可使用。</output>
        ) : null}
        <label htmlFor="ai-ledger-input">記帳內容</label>
        <textarea
          id="ai-ledger-input"
          className="ai-ledger-input"
          rows={3}
          value={inputText}
          onChange={(event) => setInputText(event.target.value)}
          placeholder="例如:7/25 中午和同事吃牛肉麵 480、7/26 繳房租 12000"
        />
        <div className="ai-ledger-actions">
          <button className="secondary-action" type="button" onClick={toggleListening} aria-pressed={listening}>
            <Mic size={16} aria-hidden="true" />
            {listening ? "停止收音" : "用說的"}
          </button>
          <button
            className="secondary-action"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus size={16} aria-hidden="true" />
            拍發票/收據
          </button>
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept="image/*"
            onChange={(event) => handleImageSelection(event.target.files?.[0])}
          />
          <button className="primary-action" type="submit" disabled={loading}>
            <Sparkles size={16} aria-hidden="true" />
            {loading ? "AI 辨識中…" : "產生記帳草稿"}
          </button>
        </div>
        {selectedImage ? <p className="field-help">已選取:{selectedImage.name}</p> : null}
      </form>

      {error ? <p className="auth-message" role="alert">{error}</p> : null}
      {message ? <output className="inline-message">{message}</output> : null}

      {suggestions.length > 0 ? (
        <section className="ai-suggestions" aria-label="AI 記帳草稿">
          <div className="draft-list-heading">
            <div>
              <p className="eyebrow">AI 補帳</p>
              <h3>{hasValidSuggestion ? "確認後寫入正式記錄" : "項目有問題:可用「填入表單」補齊欄位"}</h3>
            </div>
            <span>{suggestions.length} 筆</span>
          </div>
          {suggestions.map((suggestion) => (
            <article className="draft-card" key={suggestionKey(suggestion)}>
              <div>
                <strong>
                  {kindLabel[suggestion.input.kind as string] ?? "未知類型"} · {suggestion.draft ? `${suggestion.draft.currency} ${suggestion.draft.amount}` : "無法辨識"}
                </strong>
                <span>
                  {suggestion.draft ? `${suggestion.draft.date} · ${suggestion.draft.account}` : (asShortText(suggestion.input) || "無法辨識的項目")}
                  {suggestion.draft?.category ? ` · ${suggestion.draft.category}` : ""}
                </span>
                {suggestion.draft?.counterparty && suggestion.draft.counterparty !== "Merchant unavailable" ? (
                  <span>對象:{suggestion.draft.counterparty}{suggestion.draft?.itemName && suggestion.draft.itemName !== "Item unavailable" ? ` · ${suggestion.draft.itemName}` : ""}</span>
                ) : null}
              </div>
              {suggestion.ok && suggestion.draft ? (
                <div className="record-actions">
                  <button className="primary-action" type="button" onClick={() => confirmSuggestion(suggestion)}>
                    確認寫入
                  </button>
                  <button className="secondary-action" type="button" onClick={() => saveSuggestionAsDraft(suggestion)}>
                    存草稿
                  </button>
                  <button className="secondary-action" type="button" onClick={() => onApplyToForm(suggestion)}>
                    填入表單
                  </button>
                </div>
              ) : (
                <>
                  <ul className="ai-issues">
                    {suggestion.issues.map((issue) => <li key={issue}>{issue}</li>)}
                  </ul>
                  <div className="record-actions">
                    <button className="secondary-action" type="button" onClick={() => onApplyToForm(suggestion)}>
                      填入表單
                    </button>
                  </div>
                </>
              )}
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}

async function downscaleImage(dataUrl: string, maxDimension: number, quality: number): Promise<string> {
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image-load-failed"));
      img.src = dataUrl;
    });
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    if (scale >= 1) return dataUrl;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return dataUrl;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return dataUrl;
  }
}

// Local calendar date (YYYY-MM-DD). toISOString would return the UTC date,
// which trails the local calendar for timezones east of UTC in the early hours.
function localToday(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function asShortText(input: AiDraftSuggestion["input"]): string {
  const parts = [input.counterparty, input.itemName, input.amount].map((value) => typeof value === "string" ? value.trim() : value).filter(Boolean);
  return parts.join(" ");
}

// Stable React key for a suggestion card: prefers resolved draft fields, and
// falls back to the raw AI input for suggestions that failed to parse.
function suggestionKey(suggestion: AiDraftSuggestion): string {
  if (suggestion.draft) {
    return [suggestion.draft.date, suggestion.draft.account, suggestion.draft.kind, suggestion.draft.amount, suggestion.draft.counterparty, suggestion.draft.itemName].join("|");
  }
  return JSON.stringify(suggestion.input);
}
