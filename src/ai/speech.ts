// Shared browser speech-recognition helpers for the AI panels. The Web Speech
// API is provider-dependent and absent in some browsers, so both panels
// resolve the constructor once and surface a clear message when unavailable.
export type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  // Fires when the engine has actually begun listening (after the browser
  // loaded the speech model / granted the microphone), so the UI can show a
  // honest "starting" state instead of pretending to listen immediately.
  onstart: (() => void) | null;
  onresult: ((event: { results: ReadonlyArray<ReadonlyArray<{ transcript: string; isFinal?: boolean }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};
export type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function speechRecognition(): SpeechRecognitionCtor | null {
  const globalWindow = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return globalWindow.SpeechRecognition ?? globalWindow.webkitSpeechRecognition ?? null;
}
