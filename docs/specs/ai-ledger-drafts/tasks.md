# AI Ledger Drafts Tasks

- [x] Add the Capture intent and entry panel for AI drafts.
- [x] Add a provider-neutral AI client (OpenAI and Gemini chat-completions).
- [x] Parse AI JSON output into validated transaction drafts.
- [x] Add text input, speech input, and receipt-photo input paths.
- [x] Gate all suggestions behind user confirmation (ADR 0003).
- [x] Add unit tests for parsing, the client, and the panel flow.
- [x] Run the full test, build, and E2E gates.
- [x] Route production AI calls through the `ai-parse` Edge Function proxy.
- [x] Strengthen the receipt prompt (line items, unit confusion, 總計).
- [x] Downscale receipt photos before sending.
