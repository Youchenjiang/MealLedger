import { useEffect, useMemo, useRef, useState } from "react";
import { Mic } from "lucide-react";
import type { TransactionDraft } from "../appShell/drafts";
import type { LocalAccount } from "../manualLedger/accounts";
import { isAiConfigured } from "./config";
import { requestAiJson } from "./client";
import { DEFAULT_AI_ENTITY_POLICY, type AiEntityPolicy } from "./entityPolicy";
import { FieldBlocks } from "./fieldBlocks";
import {
  buildFieldCorrectionSystemPrompt,
  buildModeBDraft,
  localToday,
  MODE_B_FIELD_LABELS,
  MODE_B_FIELD_PROMPTS,
  modeBStepsFor,
  parseFieldCorrection,
  parseSpokenDate,
  type ModeBField,
} from "./modeB";
import type { NewEntityCarrier } from "./parse";
import { speechRecognition, type SpeechRecognitionLike } from "./speech";

export type ModeBPanelProps = Readonly<{
  accounts: Array<{ name: string; currency: string }>;
  categories: string[];
  entityPolicy?: AiEntityPolicy;
  // Creates the not-yet-existing accounts/categories the user mentioned
  // (ADR 0012), right before the confirmed write. Returns the created
  // accounts, or false when creation fails.
  onResolveNewEntities?: (suggestion: NewEntityCarrier) => LocalAccount[] | false;
  // Writes the official record. extraAccounts carries the accounts created
  // for this write so validation sees them before the caller re-renders.
  onSaveRecord: (draft: TransactionDraft, extraAccounts?: LocalAccount[]) => boolean;
  onSaveDraft?: (draft: TransactionDraft) => void;
}>;

export function ModeBPanel({
  accounts,
  categories,
  entityPolicy = DEFAULT_AI_ENTITY_POLICY,
  onResolveNewEntities,
  onSaveRecord,
  onSaveDraft,
}: ModeBPanelProps) {
  const [values, setValues] = useState<Partial<Record<ModeBField, string>>>({});
  const [step, setStep] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [transcript, setTranscript] = useState("");
  const [corrected, setCorrected] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const configured = isAiConfigured();
  const steps = useMemo(() => modeBStepsFor(values.kind), [values.kind]);
  const isComplete = step >= steps.length;
  const currentField = steps[Math.min(step, steps.length - 1)];

  // Stop any in-flight speech session when the panel unmounts.
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  // The date field is a native date picker that only accepts YYYY-MM-DD, so a
  // spoken date (or a typed one in the offline fallback) must be resolved
  // locally before it can be filled. Other fields accept the raw value.
  const resolveFieldValue = (field: ModeBField, corrected: string, raw: string): string => {
    if (corrected) return corrected;
    if (field === "date") return parseSpokenDate(raw, localToday()) ?? "";
    return raw;
  };

  // Applies the raw transcript of the current field, correcting it through a
  // single-field AI prompt when AI is configured (ADR 0010) and falling back
  // to the raw result otherwise.
  const applyTranscript = (field: ModeBField, raw: string) => {
    setTranscript(raw);
    if (!configured) {
      const value = resolveFieldValue(field, "", raw);
      setInputValue(value);
      setCorrected(value || raw);
      return;
    }
    setCorrecting(true);
    const today = localToday();
    requestAiJson({
      system: buildFieldCorrectionSystemPrompt(field, { accounts, categories, today, entityPolicy }),
      user: raw,
    })
      .then((result) => {
        const corrected = result.ok ? parseFieldCorrection(result.data) : "";
        const value = resolveFieldValue(field, corrected, raw);
        setCorrected(value || raw);
        setInputValue(value);
      })
      .finally(() => setCorrecting(false));
  };

  const toggleListening = () => {
    const Ctor = speechRecognition();
    if (!Ctor) {
      setError("此瀏覽器不支援語音輸入,請改用文字輸入。");
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
      let transcriptText = "";
      for (const result of event.results) {
        transcriptText += result[0].transcript;
      }
      applyTranscript(currentField, transcriptText);
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

  const enterField = (index: number) => {
    setStep(index);
    setInputValue(values[steps[index]] ?? "");
    setTranscript("");
    setCorrected(null);
    setError("");
    setMessage("");
  };

  const confirmField = () => {
    const value = inputValue.trim();
    if (!value) {
      setError("請先填入或說出這個欄位的內容。");
      return;
    }
    const field = currentField;
    const nextValues = { ...values, [field]: value };
    setValues(nextValues);
    // The step list re-computes when the kind changes (a transfer inserts a
    // destination step and drops the category step); the counter advancing
    // by one still lands on the right next field.
    setStep((current) => current + 1);
    setInputValue("");
    setTranscript("");
    setCorrected(null);
    setError("");
  };

  const retryField = () => {
    setTranscript("");
    setCorrected(null);
    setInputValue("");
  };

  const save = () => {
    setError("");
    setMessage("");
    const today = localToday();
    const result = buildModeBDraft(values, accounts, categories, today, entityPolicy);
    if (!result.draft) {
      setError(`欄位有問題:${result.issues.join(" ")}`);
      return;
    }
    const needsCreation = Boolean(result.newAccount || result.newCategory || result.newTransferAccount);
    let created: LocalAccount[] = [];
    if (needsCreation) {
      if (!onResolveNewEntities) {
        setError("需要先建立新的帳戶/類別才能寫入,請先在設定中調整,或改用模式 A。");
        return;
      }
      const resolved = onResolveNewEntities({
        newAccount: result.newAccount,
        newCategory: result.newCategory,
        newTransferAccount: result.newTransferAccount,
      });
      if (resolved === false) {
        setError("新的帳戶/類別無法建立,請手動檢查。");
        return;
      }
      created = resolved;
    }
    if (!onSaveRecord(result.draft, created)) {
      setError("這筆記錄無法建立,請檢查帳戶與欄位。");
      return;
    }
    setValues({});
    setStep(0);
    setMessage("已確認並寫入正式記錄。");
  };

  const saveDraft = () => {
    setError("");
    setMessage("");
    if (!onSaveDraft) return;
    const today = localToday();
    const result = buildModeBDraft(values, accounts, categories, today, entityPolicy);
    if (!result.draft) {
      setError(`欄位有問題:${result.issues.join(" ")}`);
      return;
    }
    onSaveDraft(result.draft);
    setValues({});
    setStep(0);
    setMessage("已存到草稿佇列,可到 Ledger 的 Review queue 繼續處理。");
  };

  return (
    <div className="mode-b-panel">
      <p className="field-help">
        欄位會一個一個亮起,念出內容填入;每一欄會先顯示 AI 校對結果,確認後才進下一欄。
      </p>
      {!configured ? (
        <output className="inline-message">尚未設定 AI 金鑰:將直接使用語音辨識的原始結果。</output>
      ) : null}
      <FieldBlocks
        items={steps.map((field, index) => ({
          field,
          label: MODE_B_FIELD_LABELS[field],
          value: index < step ? (values[field] ?? "") : index === step ? inputValue : "",
          state: index < step ? "filled" : index === step ? "current" : "pending",
        }))}
      />
      {!isComplete ? (
        <div className="mode-b-current">
          <p className="mode-b-prompt">{MODE_B_FIELD_PROMPTS[currentField]}</p>
          <div className="ai-ledger-actions">
            <button className="secondary-action" type="button" onClick={toggleListening} aria-pressed={listening}>
              <Mic size={16} aria-hidden="true" />
              {listening ? "停止收音" : "用說的"}
            </button>
            <button className="secondary-action" type="button" onClick={retryField} disabled={!transcript}>
              重新說一次
            </button>
          </div>
          <label htmlFor="mode-b-input">{MODE_B_FIELD_LABELS[currentField]}</label>
          <input
            id="mode-b-input"
            className="mode-b-input"
            type={currentField === "date" ? "date" : "text"}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder={currentField === "date" ? undefined : "可直接打字,或按下「用說的」"}
          />
          {correcting ? <p className="field-help">AI 校對中…</p> : null}
          {corrected !== null && corrected !== transcript && transcript ? (
            <p className="field-help">AI 校對結果:{corrected}</p>
          ) : null}
          <div className="record-actions">
            <button className="primary-action" type="button" onClick={confirmField} disabled={!inputValue.trim()}>
              填入此欄
            </button>
            <button className="secondary-action" type="button" onClick={() => enterField(step - 1)} disabled={step === 0}>
              上一步
            </button>
          </div>
        </div>
      ) : (
        <div className="mode-b-summary">
          <h3>確認這筆記錄</h3>
          <dl className="mode-b-summary-list">
            {steps.map((field) => (
              <div key={field}>
                <dt>{MODE_B_FIELD_LABELS[field]}</dt>
                <dd>{values[field]}</dd>
              </div>
            ))}
          </dl>
          <div className="record-actions">
            <button className="primary-action" type="button" onClick={save}>
              確認存檔
            </button>
            {onSaveDraft ? (
              <button className="secondary-action" type="button" onClick={saveDraft}>
                存草稿
              </button>
            ) : null}
            <button className="secondary-action" type="button" onClick={() => enterField(steps.length - 1)}>
              回去修改
            </button>
          </div>
        </div>
      )}
      {error ? <p className="auth-message" role="alert">{error}</p> : null}
      {message ? <output className="inline-message">{message}</output> : null}
    </div>
  );
}
