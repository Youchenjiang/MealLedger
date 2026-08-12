import { Fragment, useEffect, useRef, useState } from "react";
import { ImagePlus, Mic, Sparkles } from "lucide-react";
import type { TransactionDraft } from "../appShell/drafts";
import type { LocalAccount } from "../manualLedger/accounts";
import { isAiConfigured } from "./config";
import { requestAiJson } from "./client";
import { DEFAULT_AI_ENTITY_POLICY, type AiEntityPolicy } from "./entityPolicy";
import { buildLedgerSystemPrompt, buildUserPrompt } from "./prompt";
import { parseDraftSuggestions, type AiDraftSuggestion, type AiSuggestionInput } from "./parse";

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
  // Per-entity-type policy for whether capture may mention accounts or
  // categories that do not exist yet (see ADR 0012). Defaults to existing-only
  // so current behavior is preserved.
  entityPolicy?: AiEntityPolicy;
  // Creates the not-yet-existing accounts/categories a suggestion carries
  // (account with TWD like the default wallet, category appended to custom
  // categories). Called only for ask/auto policies, right before the confirmed
  // write. Returns the created accounts (empty when none were needed), or
  // false when creation fails.
  onResolveNewEntities?: (suggestion: AiDraftSuggestion) => LocalAccount[] | false;
  // Writes the official record. extraAccounts carries the accounts that were
  // just created for this write, so validation and balance tracking see them
  // even though the caller's accounts state has not re-rendered yet.
  onSaveRecord: (draft: TransactionDraft, extraAccounts?: LocalAccount[]) => boolean;
  onSaveDraft: (draft: TransactionDraft) => void;
  // Prefills the ledger form with the fields the AI could identify so the
  // user can complete the remaining ones (account, category, …) manually.
  onApplyToForm: (suggestion: AiDraftSuggestion) => void;
}>;

export function AiLedgerPanel({ accounts, categories, entityPolicy = DEFAULT_AI_ENTITY_POLICY, onResolveNewEntities, onSaveRecord, onSaveDraft, onApplyToForm }: AiLedgerPanelProps) {
  const [inputText, setInputText] = useState("");
  const [selectedImage, setSelectedImage] = useState<{ name: string; dataUrl: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AiDraftSuggestion[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pendingNewEntities, setPendingNewEntities] = useState<AiDraftSuggestion | null>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const configured = isAiConfigured();
  const hasValidSuggestion = suggestions.some((item) => item.ok);
  const anyInferred = suggestions.some((suggestion) => suggestion.draft && hasInferredField(suggestion.input));

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
      const system = buildLedgerSystemPrompt({ accounts, categories, today, entityPolicy });
      const user = buildUserPrompt(inputText, selectedImage?.dataUrl);
      const result = await requestAiJson({ system, user, imageDataUrl: selectedImage?.dataUrl });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const parsed = parseDraftSuggestions(result.data, accounts, categories, today, entityPolicy);
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

  // Whether confirming this suggestion must first ask the user to create the
  // not-yet-existing entities, per the per-entity-type ask policy.
  const needsNewEntityAsk = (suggestion: AiDraftSuggestion): boolean => {
    return Boolean(
      (suggestion.newAccount && entityPolicy.account === "ask")
      || (suggestion.newTransferAccount && entityPolicy.account === "ask")
      || (suggestion.newCategory && entityPolicy.category === "ask"),
    );
  };

  // Creates any new entities the policy allows (auto, or the approved ask
  // flow), then writes the official record. Creation never happens as a side
  // effect of the AI call itself; only of the user's confirmed write.
  const resolveAndPersist = (suggestion: AiDraftSuggestion) => {
    if (!suggestion.draft) return;
    const needsCreation = Boolean(suggestion.newAccount || suggestion.newCategory || suggestion.newTransferAccount);
    let created: LocalAccount[] = [];
    if (needsCreation) {
      if (!onResolveNewEntities) {
        setError("需要先建立新的帳戶/類別才能寫入,請改用「填入表單」或先在設定中建立。");
        return;
      }
      const resolved = onResolveNewEntities(suggestion);
      if (resolved === false) {
        setError("新的帳戶/類別無法建立,請手動檢查。");
        return;
      }
      created = resolved;
    }
    const saved = onSaveRecord(suggestion.draft, created);
    if (!saved) {
      setError("這筆記錄無法建立,請檢查帳戶與欄位後手動新增。");
      return;
    }
    setSuggestions((current) => current.filter((item) => item !== suggestion));
    setMessage("已確認並寫入正式記錄。");
  };

  const confirmSuggestion = (suggestion: AiDraftSuggestion) => {
    if (!suggestion.draft) return;
    setError("");
    setMessage("");
    if (needsNewEntityAsk(suggestion)) {
      setPendingNewEntities(suggestion);
      return;
    }
    resolveAndPersist(suggestion);
  };

  const approveNewEntities = () => {
    const suggestion = pendingNewEntities;
    setPendingNewEntities(null);
    if (suggestion) {
      resolveAndPersist(suggestion);
    }
  };

  const cancelNewEntities = () => {
    setPendingNewEntities(null);
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

      {pendingNewEntities ? (
        <AskNewEntitiesDialog
          suggestion={pendingNewEntities}
          onApprove={approveNewEntities}
          onCancel={cancelNewEntities}
        />
      ) : null}

      {suggestions.length > 0 ? (
        <section className="ai-suggestions" aria-label="AI 記帳草稿">
          <div className="draft-list-heading">
            <div>
              <p className="eyebrow">AI 補帳</p>
              <h3>{hasValidSuggestion ? "確認後寫入正式記錄" : "項目有問題:可用「填入表單」補齊欄位"}</h3>
            </div>
            <span>{suggestions.length} 筆</span>
          </div>
          {anyInferred ? <p className="field-help">底線欄位是 AI 推論的,請確認後再寫入。</p> : null}
          {suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestionKey(suggestion)}
              suggestion={suggestion}
              onConfirm={confirmSuggestion}
              onSaveDraft={saveSuggestionAsDraft}
              onApplyToForm={onApplyToForm}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}

// The title suffix after the kind label: the currency and amount for a
// valid draft, otherwise a short note explaining why the card is not
// confirmable.
function statusSuffixFor(suggestion: AiDraftSuggestion, inferred: (field: string) => boolean): React.ReactNode {
  if (suggestion.draft) {
    return (
      <>
        {" · "}
        <InferredSpan inferred={inferred("currency")}>{suggestion.draft.currency}</InferredSpan>
        {" "}
        <InferredSpan inferred={inferred("amount")}>{suggestion.draft.amount}</InferredSpan>
      </>
    );
  }
  if (kindLabel[suggestion.input.kind as string]) {
    return " · 欄位不完整";
  }
  return " · 無法辨識";
}

function SuggestionCard({
  suggestion,
  onConfirm,
  onSaveDraft,
  onApplyToForm,
}: Readonly<{
  suggestion: AiDraftSuggestion;
  onConfirm: (suggestion: AiDraftSuggestion) => void;
  onSaveDraft: (suggestion: AiDraftSuggestion) => void;
  onApplyToForm: (suggestion: AiDraftSuggestion) => void;
}>) {
  const merchant = suggestion.draft ? merchantLine(suggestion.draft, suggestion.input) : null;
  const inferred = (field: string) => isInferred(suggestion.input, field);
  return (
    <article className="draft-card">
      <div>
        <strong>
          <InferredSpan inferred={inferred("kind")}>{kindLabel[suggestion.input.kind as string] ?? "未知類型"}</InferredSpan>
          {statusSuffixFor(suggestion, inferred)}
        </strong>
        <span>
          {suggestion.draft ? (
            <>
              <DateDisplay inputDate={suggestion.input.date} date={suggestion.draft.date} inferred={inferred("date")} />
              {" · "}
              <InferredSpan inferred={inferred("account")}>{suggestion.draft.account}</InferredSpan>
              {suggestion.newAccount ? <NewEntityTag label="帳戶尚不存在" /> : null}
              {suggestion.draft.kind === "transfer" && suggestion.draft.transferAccount ? (
                <>
                  {" → "}
                  <InferredSpan inferred={inferred("transferAccount")}>{suggestion.draft.transferAccount}</InferredSpan>
                  {suggestion.newTransferAccount ? <NewEntityTag label="帳戶尚不存在" /> : null}
                </>
              ) : null}
            </>
          ) : (
            partialLine(suggestion.input) || "無法辨識的項目"
          )}
          {suggestion.draft?.category ? (
            <>
              {" · "}
              <InferredSpan inferred={inferred("category")}>{suggestion.draft.category}</InferredSpan>
              {suggestion.newCategory ? <NewEntityTag label="類別尚不存在" /> : null}
            </>
          ) : null}
        </span>
        {merchant ? <span>{merchant}</span> : null}
      </div>
      {suggestion.ok && suggestion.draft ? (
        <div className="record-actions">
          <button className="primary-action" type="button" onClick={() => onConfirm(suggestion)}>
            確認寫入
          </button>
          <button className="secondary-action" type="button" onClick={() => onSaveDraft(suggestion)}>
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
  );
}

function AskNewEntitiesDialog({
  suggestion,
  onApprove,
  onCancel,
}: Readonly<{
  suggestion: AiDraftSuggestion;
  onApprove: () => void;
  onCancel: () => void;
}>) {
  return (
    <dialog className="ask-new-entities" open aria-label="確認新增帳戶或類別">
      <p>
        這筆記錄提到尚未建立的
        {[
          suggestion.newAccount ? `帳戶「${suggestion.newAccount}」` : "",
          suggestion.newTransferAccount ? `帳戶「${suggestion.newTransferAccount}」` : "",
          suggestion.newCategory ? `類別「${suggestion.newCategory}」` : "",
        ].filter(Boolean).join("與")}
        ,是否要新增?
      </p>
      <div className="record-actions">
        <button className="primary-action" type="button" onClick={onApprove}>
          新增並寫入
        </button>
        <button className="secondary-action" type="button" onClick={onCancel}>
          取消
        </button>
      </div>
    </dialog>
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

// Shows what the model did recognize on a card whose draft was rejected
// (missing account/category/amount), so a failed item is not reduced to a
// cryptic snippet. Inferred marking still applies from the explicit list.
function partialLine(input: AiSuggestionInput): React.ReactNode {
  const parts: Array<{ text: string; field: string }> = [];
  if (typeof input.date === "string" && input.date.trim()) parts.push({ text: input.date.trim(), field: "date" });
  if (typeof input.counterparty === "string" && input.counterparty.trim()) parts.push({ text: input.counterparty.trim(), field: "counterparty" });
  if (typeof input.itemName === "string" && input.itemName.trim()) parts.push({ text: input.itemName.trim(), field: "itemName" });
  if (typeof input.amount === "string" || typeof input.amount === "number") {
    const rawAmount = String(input.amount).trim();
    if (rawAmount) parts.push({ text: rawAmount, field: "amount" });
  }
  if (parts.length === 0) return null;
  return parts.map((part, index) => (
    <Fragment key={part.field}>
      {index > 0 ? " · " : null}
      <InferredSpan inferred={isInferred(input, part.field)}>{part.text}</InferredSpan>
    </Fragment>
  ));
}

// Fields the model reports the user explicitly mentioned. An absent or
// non-array explicit list means no provenance was reported, so nothing is
// marked as inferred (legacy responses keep their current look).
function explicitFieldNames(input: AiSuggestionInput): Set<string> {
  const raw = input.explicit;
  if (!Array.isArray(raw)) return new Set();
  const names = new Set<string>();
  for (const value of raw) {
    if (typeof value === "string" && value.trim()) {
      names.add(value.trim().toLowerCase());
    }
  }
  return names;
}

function isInferred(input: AiSuggestionInput, field: string): boolean {
  const explicit = explicitFieldNames(input);
  return explicit.size > 0 && !explicit.has(field);
}

// Whether the year of the draft date was derived by the app: the parser fills
// the current year when the model input has no 4-digit year (e.g. "7/25").
function isDerivedYear(inputDate: unknown): boolean {
  return typeof inputDate !== "string" || !/\d{4}/.test(inputDate);
}

// Whether the suggestion card shows any inferred marking (used for the hint).
function hasInferredField(input: AiSuggestionInput): boolean {
  if (isDerivedYear(input.date)) return true;
  const explicit = explicitFieldNames(input);
  if (explicit.size === 0) return false;
  return ["kind", "date", "account", "category", "counterparty", "itemName", "amount", "currency", "transferAccount"].some((field) => !explicit.has(field));
}

function InferredSpan({ inferred, children }: Readonly<{ inferred: boolean; children: React.ReactNode }>): React.ReactNode {
  return inferred
    ? <span className="inferred-field" title="AI 推論的欄位,請確認">{children}</span>
    : children;
}

// Marks an account/category the user mentioned that does not exist yet; it is
// created only when the user confirms the write (see ADR 0012).
function NewEntityTag({ label }: Readonly<{ label: string }>): React.ReactElement {
  return <span className="new-entity-badge" title={label}>{label}</span>;
}

// Renders the draft date, marking the year as inferred when the parser derived
// it from today (the model input carried no 4-digit year).
function DateDisplay({ inputDate, date, inferred }: Readonly<{ inputDate: unknown; date: string; inferred: boolean }>): React.ReactElement {
  if (!isDerivedYear(inputDate)) {
    return <InferredSpan inferred={inferred}>{date}</InferredSpan>;
  }
  const year = date.slice(0, 4);
  const rest = date.slice(4);
  return (
    <Fragment>
      <InferredSpan inferred>{year}</InferredSpan>
      <InferredSpan inferred={inferred}>{rest}</InferredSpan>
    </Fragment>
  );
}

// Renders the merchant/item line of a suggestion card. Counterparty and item
// name are shown independently so an item name is never hidden behind a
// missing counterparty (the parser fills a placeholder when a field is
// absent, so those placeholders are suppressed here).
function merchantLine(draft: TransactionDraft, input: AiSuggestionInput): React.ReactNode {
  const counterparty = draft.counterparty && draft.counterparty !== "Merchant unavailable" ? draft.counterparty : "";
  const itemName = draft.itemName && draft.itemName !== "Item unavailable" ? draft.itemName : "";
  const items: Array<{ text: string; field: string }> = [];
  if (counterparty) items.push({ text: `對象:${counterparty}`, field: "counterparty" });
  if (itemName) items.push({ text: `品項:${itemName}`, field: "itemName" });
  if (items.length === 0) return null;
  return (
    <Fragment>
      {items.map((item, index) => (
        <Fragment key={item.field}>
          {index > 0 ? " · " : null}
          <InferredSpan inferred={isInferred(input, item.field)}>{item.text}</InferredSpan>
        </Fragment>
      ))}
    </Fragment>
  );
}

// Stable React key for a suggestion card: prefers resolved draft fields, and
// falls back to the raw AI input for suggestions that failed to parse.
function suggestionKey(suggestion: AiDraftSuggestion): string {
  if (suggestion.draft) {
    return [suggestion.draft.date, suggestion.draft.account, suggestion.draft.kind, suggestion.draft.amount, suggestion.draft.counterparty, suggestion.draft.itemName].join("|");
  }
  return JSON.stringify(suggestion.input);
}
