import { useEffect, useMemo, useRef, useState } from "react";
import type { TransactionDraft } from "../appShell/drafts";
import type { LocalAccount } from "../manualLedger/accounts";
import { isAiConfigured } from "./config";
import { requestAiJson } from "./client";
import { DEFAULT_AI_ENTITY_POLICY, type AiEntityPolicy } from "./entityPolicy";
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

function micNoteText(
  starting: boolean,
  listening: boolean,
  hasTranscript: boolean,
  corrected: string | null,
  inputValue: string,
): string {
  if (starting) return "正在啟動麥克風,請稍候…";
  if (listening) return "正在聽…";
  if (hasTranscript) return `AI 校對成「${corrected ?? inputValue}」，確認後填入`;
  return "點擊麥克風開始說";
}

// Speech engine state: microphone toggling, interim/final transcripts, and
// the single-field AI correction call (ADR 0010). Calls back with the raw
// transcript and the AI-corrected text ("" when AI is off or failed).
function useModeBSpeech({
  configured,
  currentField,
  accounts,
  categories,
  entityPolicy,
  onTranscript,
  onError,
}: Readonly<{
  configured: boolean;
  currentField: ModeBField;
  accounts: ModeBPanelProps["accounts"];
  categories: string[];
  entityPolicy: AiEntityPolicy;
  onTranscript: (field: ModeBField, raw: string, corrected: string) => void;
  onError: (message: string) => void;
}>) {
  const [transcript, setTranscript] = useState("");
  // Interim speech text shown while listening (the final result replaces it).
  const [liveText, setLiveText] = useState("");
  const [correcting, setCorrecting] = useState(false);
  const [listening, setListening] = useState(false);
  // True from the click until the engine's onstart fires: the browser may
  // take a few seconds to load the speech model / grant the microphone, and
  // during that window nothing is being recorded yet.
  const [starting, setStarting] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Stop any in-flight speech session when the panel unmounts.
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  const applyTranscript = (field: ModeBField, raw: string) => {
    setTranscript(raw);
    if (!configured) {
      onTranscript(field, raw, "");
      return;
    }
    setCorrecting(true);
    const today = localToday();
    requestAiJson({
      system: buildFieldCorrectionSystemPrompt(field, { accounts, categories, today, entityPolicy }),
      user: raw,
    })
      .then((result) => {
        onTranscript(field, raw, result.ok ? parseFieldCorrection(result.data) : "");
      })
      .finally(() => setCorrecting(false));
  };

  const toggleListening = () => {
    const Ctor = speechRecognition();
    if (!Ctor) {
      onError("此瀏覽器不支援語音輸入,請改用文字輸入。");
      return;
    }
    if (listening || starting) {
      recognitionRef.current?.stop();
      return;
    }
    // Reuse the previous recognition instance when possible: the browser
    // loads the speech model on the first start, so a warm instance begins
    // hearing almost immediately on later clicks. Some engines reject
    // restarting the same object, so fall back to a fresh one.
    const recognition: SpeechRecognitionLike = recognitionRef.current ?? new Ctor();
    recognition.lang = "zh-TW";
    // Interim results stream the words as they are heard; the final result
    // (the last item, flagged isFinal) drives the correction flow.
    recognition.interimResults = true;
    // The latest interim text, so a session that ends without a final result
    // (some engines never flag the last item isFinal) still fills the field.
    let lastInterim = "";
    recognition.onstart = () => setStarting(false);
    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const text = last?.[0]?.transcript ?? "";
      if (last?.[0]?.isFinal) {
        lastInterim = "";
        setLiveText("");
        applyTranscript(currentField, text);
      } else {
        lastInterim = text;
        setLiveText(text);
      }
    };
    recognition.onend = () => {
      setListening(false);
      setStarting(false);
      // The engine ended without flagging a final result; promote the last
      // interim words so the spoken value is still applied (e.g. 念「昨天」
      // 後停頓,Chrome 常見只送 interim 就結束)。
      if (lastInterim.trim()) {
        const pending = lastInterim;
        lastInterim = "";
        setLiveText("");
        applyTranscript(currentField, pending);
      }
    };
    recognition.onerror = () => {
      setListening(false);
      setStarting(false);
      setLiveText("");
      onError("語音辨識失敗,請再試一次或改用文字輸入。");
    };
    recognitionRef.current = recognition;
    setLiveText("");
    setStarting(true);
    setListening(true);
    try {
      recognition.start();
    } catch {
      // The reused instance may be in a state the engine rejects (e.g. a
      // previous session errored out); start over with a fresh one.
      const fresh = new Ctor();
      recognitionRef.current = fresh;
      fresh.lang = "zh-TW";
      fresh.interimResults = true;
      fresh.onstart = () => setStarting(false);
      fresh.onresult = recognition.onresult;
      fresh.onend = recognition.onend;
      fresh.onerror = recognition.onerror;
      fresh.start();
    }
  };

  const clearTranscript = () => {
    setTranscript("");
    setLiveText("");
  };

  return { listening, starting, liveText, transcript, correcting, toggleListening, clearTranscript };
}

// The step-by-step capture state: the filled values, the current step, the
// editable input, and the confirm/save flows. Kept separate from the speech
// engine so each unit stays small and testable.
function useModeBCapture({
  accounts,
  categories,
  entityPolicy,
  onResolveNewEntities,
  onSaveRecord,
  onSaveDraft,
}: Readonly<{
  accounts: ModeBPanelProps["accounts"];
  categories: string[];
  entityPolicy: AiEntityPolicy;
  onResolveNewEntities: ModeBPanelProps["onResolveNewEntities"];
  onSaveRecord: ModeBPanelProps["onSaveRecord"];
  onSaveDraft: ModeBPanelProps["onSaveDraft"];
}>) {
  const [values, setValues] = useState<Partial<Record<ModeBField, string>>>({});
  const [step, setStep] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [corrected, setCorrected] = useState<string | null>(null);
  const [error, setError] = useState("");
  // Which completion banner is showing after a confirmed write.
  const [done, setDone] = useState<"" | "saved" | "draft">("");

  const steps = useMemo(() => modeBStepsFor(values.kind), [values.kind]);
  const isComplete = step >= steps.length;
  const currentField = steps[Math.min(step, steps.length - 1)];

  // The date field is a native date picker that only accepts YYYY-MM-DD, so a
  // spoken date (or a typed one in the offline fallback) must be resolved
  // locally before it can be filled. Other fields accept the raw value.
  const handleTranscript = (field: ModeBField, raw: string, correctedText: string) => {
    let value = correctedText || raw;
    if (!correctedText && field === "date") {
      value = parseSpokenDate(raw, localToday()) ?? "";
    }
    setCorrected(value || raw);
    setInputValue(value);
  };

  const enterField = (index: number) => {
    setStep(index);
    setInputValue(values[steps[index]] ?? "");
    setCorrected(null);
    setError("");
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
    setCorrected(null);
    setError("");
  };

  const retryField = () => {
    setInputValue("");
    setCorrected(null);
  };

  const resetAll = () => {
    setValues({});
    setStep(0);
    setInputValue("");
    setCorrected(null);
    setError("");
    setDone("");
  };

  const save = () => {
    setError("");
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
    setDone("saved");
  };

  const saveDraft = () => {
    setError("");
    if (!onSaveDraft) return;
    const today = localToday();
    const result = buildModeBDraft(values, accounts, categories, today, entityPolicy);
    if (!result.draft) {
      setError(`欄位有問題:${result.issues.join(" ")}`);
      return;
    }
    onSaveDraft(result.draft);
    setDone("draft");
  };

  return {
    values,
    step,
    steps,
    isComplete,
    currentField,
    inputValue,
    setInputValue,
    corrected,
    error,
    done,
    canSaveDraft: Boolean(onSaveDraft),
    enterField,
    confirmField,
    retryField,
    resetAll,
    save,
    saveDraft,
    handleTranscript,
    setError,
  };
}

export function ModeBPanel({
  accounts,
  categories,
  entityPolicy = DEFAULT_AI_ENTITY_POLICY,
  onResolveNewEntities,
  onSaveRecord,
  onSaveDraft,
}: ModeBPanelProps) {
  const configured = isAiConfigured();
  const capture = useModeBCapture({ accounts, categories, entityPolicy, onResolveNewEntities, onSaveRecord, onSaveDraft });
  const speech = useModeBSpeech({
    configured,
    currentField: capture.currentField,
    accounts,
    categories,
    entityPolicy,
    onTranscript: capture.handleTranscript,
    onError: capture.setError,
  });
  const hasTranscript = speech.transcript !== "";
  const micNote = micNoteText(speech.starting, speech.listening, hasTranscript, capture.corrected, capture.inputValue);

  if (capture.done) {
    return <ModeBDoneView done={capture.done} onReset={capture.resetAll} />;
  }

  return (
    <div className="mode-b-panel">
      <p className="field-help">
        欄位會一個一個亮起,念出內容填入;每一欄會先顯示 AI 校對結果,確認後才進下一欄。
      </p>
      {!configured ? (
        <output className="inline-message">尚未設定 AI 金鑰:將直接使用語音辨識的原始結果。</output>
      ) : null}

      <ModeBProgress steps={capture.steps} step={capture.step} values={capture.values} />

      {!capture.isComplete ? (
        <ModeBStage
          step={capture.step}
          steps={capture.steps}
          currentField={capture.currentField}
          transcript={speech.transcript}
          liveText={speech.liveText}
          listening={speech.listening}
          starting={speech.starting}
          correcting={speech.correcting}
          micNote={micNote}
          inputValue={capture.inputValue}
          onToggleListening={speech.toggleListening}
          onInputChange={capture.setInputValue}
          onRetry={() => {
            capture.retryField();
            speech.clearTranscript();
          }}
          onConfirm={capture.confirmField}
        />
      ) : (
        <ModeBSummaryView
          steps={capture.steps}
          values={capture.values}
          onSave={capture.save}
          onSaveDraft={capture.canSaveDraft ? capture.saveDraft : undefined}
          onBack={() => {
            capture.enterField(capture.steps.length - 1);
            speech.clearTranscript();
          }}
        />
      )}
      {capture.error ? <p className="auth-message" role="alert">{capture.error}</p> : null}
    </div>
  );
}

function ModeBProgress({
  steps,
  step,
  values,
}: Readonly<{
  steps: ModeBField[];
  step: number;
  values: Partial<Record<ModeBField, string>>;
}>) {
  return (
    <>
      <div className="mode-b-progress" aria-hidden="true">
        {steps.map((field, index) => (
          <div
            className={`mode-b-p${index < step ? " done" : ""}${index === step ? " now" : ""}`}
            key={field}
          />
        ))}
      </div>

      <div className="mode-b-filled" aria-label="已填欄位">
        {steps.slice(0, step).map((field) => (
          <span className="mode-b-chip" key={field}>
            <span>{MODE_B_FIELD_LABELS[field]}</span>
            <b>{values[field]}</b>
          </span>
        ))}
      </div>
    </>
  );
}

function ModeBDoneView({ done, onReset }: Readonly<{ done: "saved" | "draft"; onReset: () => void }>) {
  return (
    <div className="mode-b-panel">
      <div className="mode-b-done">
        <span className="mode-b-done-icon">✓</span>
        <p>{done === "saved" ? "已確認並寫入正式記錄。" : "已存到草稿佇列,可到 Ledger 的 Review queue 繼續處理。"}</p>
        <button className="primary-action" type="button" onClick={onReset}>
          ↺ 重新開始
        </button>
      </div>
    </div>
  );
}

function ModeBStage({
  step,
  steps,
  currentField,
  transcript,
  liveText,
  listening,
  starting,
  correcting,
  micNote,
  inputValue,
  onToggleListening,
  onInputChange,
  onRetry,
  onConfirm,
}: Readonly<{
  step: number;
  steps: ModeBField[];
  currentField: ModeBField;
  transcript: string;
  liveText: string;
  listening: boolean;
  starting: boolean;
  correcting: boolean;
  micNote: string;
  inputValue: string;
  onToggleListening: () => void;
  onInputChange: (value: string) => void;
  onRetry: () => void;
  onConfirm: () => void;
}>) {
  const hasTranscript = transcript !== "";
  return (
    <>
      <div className="mode-b-stage">
        <p className="mode-b-step">第 {step + 1} 步 · 共 {steps.length} 步</p>
        <p className="mode-b-field-name">{MODE_B_FIELD_LABELS[currentField]}</p>
        <p className="mode-b-hint">{MODE_B_FIELD_PROMPTS[currentField]}</p>
        <ModeBMicControl
          listening={listening}
          starting={starting}
          liveText={liveText}
          micNote={micNote}
          onToggle={onToggleListening}
        />
      </div>
      <ModeBResultRow
        currentField={currentField}
        transcript={transcript}
        inputValue={inputValue}
        correcting={correcting}
        onInputChange={onInputChange}
      />
      <ModeBStageActions
        hasTranscript={hasTranscript}
        listening={listening}
        correcting={correcting}
        inputValue={inputValue}
        onRetry={onRetry}
        onConfirm={onConfirm}
      />
    </>
  );
}

function ModeBMicControl({
  listening,
  starting,
  liveText,
  micNote,
  onToggle,
}: Readonly<{
  listening: boolean;
  starting: boolean;
  liveText: string;
  micNote: string;
  onToggle: () => void;
}>) {
  const active = listening || starting;
  return (
    <div className="mode-b-mic-wrap">
      <div className={`mode-b-ring${active ? " pulse" : ""}`} />
      <button
        className={`mode-b-mic${active ? " listening" : ""}`}
        type="button"
        aria-label={active ? "停止收音" : "用說的"}
        onClick={onToggle}
      >
        🎙
      </button>
      <div className={`mode-b-wave${listening ? " on" : ""}`} aria-hidden="true">
        <i /><i /><i /><i /><i /><i /><i />
      </div>
      <p className={`mode-b-live${liveText ? " on" : ""}`} aria-live="polite">{liveText}</p>
      <p className={`mode-b-note${active ? " listening" : ""}`}>{micNote}</p>
    </div>
  );
}

function ModeBResultRow({
  currentField,
  transcript,
  inputValue,
  correcting,
  onInputChange,
}: Readonly<{
  currentField: ModeBField;
  transcript: string;
  inputValue: string;
  correcting: boolean;
  onInputChange: (value: string) => void;
}>) {
  const isDate = currentField === "date";
  return (
    <div className="mode-b-result">
      <div className="mode-b-row">
        <span className="mode-b-tag raw">聽到的</span>
        <span className="mode-b-txt" aria-live="polite">{transcript || "—"}</span>
      </div>
      <div className="mode-b-row ai-row">
        <span className="mode-b-tag ai">AI 校對</span>
        <input
          id="mode-b-input"
          className="mode-b-input"
          type={isDate ? "date" : "text"}
          value={inputValue}
          aria-label={MODE_B_FIELD_LABELS[currentField]}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder={isDate ? undefined : "可直接打字,或按下「用說的」"}
        />
      </div>
      <p className="mode-b-ai-note">校對結果供你確認,可以直接修改後填入。</p>
      {correcting ? <p className="field-help">AI 校對中…</p> : null}
    </div>
  );
}

function ModeBStageActions({
  hasTranscript,
  listening,
  correcting,
  inputValue,
  onRetry,
  onConfirm,
}: Readonly<{
  hasTranscript: boolean;
  listening: boolean;
  correcting: boolean;
  inputValue: string;
  onRetry: () => void;
  onConfirm: () => void;
}>) {
  return (
    <div className="mode-b-actions">
      <button className="secondary-action" type="button" onClick={onRetry} disabled={!hasTranscript || listening}>
        ↺ 重新說
      </button>
      <button className="primary-action" type="button" onClick={onConfirm} disabled={!inputValue.trim() || listening || correcting}>
        ✓ 填入此欄
      </button>
    </div>
  );
}

function ModeBSummaryView({
  steps,
  values,
  onSave,
  onSaveDraft,
  onBack,
}: Readonly<{
  steps: ModeBField[];
  values: Partial<Record<ModeBField, string>>;
  onSave: () => void;
  onSaveDraft?: () => void;
  onBack: () => void;
}>) {
  return (
    <div className="mode-b-summary">
      <h2>確認這筆記錄</h2>
      <div className="mode-b-summary-list">
        {steps.map((field) => (
          <div className="mode-b-s-row" key={field}>
            <dt>{MODE_B_FIELD_LABELS[field]}</dt>
            <dd>{values[field]}</dd>
          </div>
        ))}
      </div>
      <div className="mode-b-actions">
        <button className="primary-action" type="button" onClick={onSave}>
          ✓ 確認寫入
        </button>
        {onSaveDraft ? (
          <button className="secondary-action" type="button" onClick={onSaveDraft}>
            存草稿
          </button>
        ) : null}
        <button className="secondary-action" type="button" onClick={onBack}>
          回去修改
        </button>
      </div>
    </div>
  );
}
