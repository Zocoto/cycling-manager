import { CHAT_TRANSLATION_BATCH_SIZE, getChatTranslationSourceKey, hasTranslatableChatText, splitChatMessageForTranslation, type ChatMessageTranslationState, type ChatTranslationTargetLocale } from "./chat-translation";

export type AutoTranslationMessage = { id: string; sportingDirectorId: string; message: string; editedAt: string | null };
type TranslationResponse = { messageId: string; status: string; translation?: { translatedText: string; detectedSourceLocale: string | null } };

// Only visible rows are queued. One in-flight batch, no polling and no retry loop.
export class ChatAutoTranslationQueue {
  private messages = new Map<string, AutoTranslationMessage>();
  private visible = new Set<string>();
  private attempted = new Set<string>();
  private busyRetried = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private controller: AbortController | null = null;
  private stopped = false;
  private paused = false;
  private running = false;
  private nextRequestAt = 0;
  constructor(private options: {
    directorId: string; targetLocale: ChatTranslationTargetLocale;
    getState: (id: string) => ChatMessageTranslationState | undefined;
    onState: (id: string, state: ChatMessageTranslationState) => void;
    onPause: () => void;
    canRun?: () => boolean;
    fetcher?: typeof fetch;
  }) {}

  setMessages(messages: readonly AutoTranslationMessage[]) {
    this.messages = new Map(messages.map((message) => [message.id, message]));
  }
  observe(id: string, visible: boolean) {
    if (visible) this.visible.add(id); else this.visible.delete(id);
    this.wake();
  }
  wake() {
    if (this.timer || this.running || this.stopped || this.paused) return;
    this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, Math.max(650, this.nextRequestAt - Date.now()));
  }
  dispose() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.controller?.abort();
  }
  private key(message: AutoTranslationMessage) { return getChatTranslationSourceKey(message); }
  private async flush() {
    if (this.stopped || this.paused || this.running || this.options.canRun?.() === false) return;
    const batch = [...this.visible].flatMap((id) => {
      const message = this.messages.get(id);
      const state = this.options.getState(id);
      return message && message.sportingDirectorId !== this.options.directorId
        && !this.attempted.has(this.key(message))
        && !(state?.targetLocale === this.options.targetLocale && (!state.sourceKey || state.sourceKey === this.key(message)) && (state.status === "loaded" || state.status === "loading"))
        && hasTranslatableChatText(splitChatMessageForTranslation(message.message)) ? [message] : [];
    }).slice(0, CHAT_TRANSLATION_BATCH_SIZE);
    if (!batch.length) return;
    this.running = true;
    this.controller = new AbortController();
    for (const message of batch) {
      this.attempted.add(this.key(message));
      this.options.onState(message.id, this.state("loading", message));
    }
    const timeout = setTimeout(() => this.controller?.abort(), 12_000);
    try {
      const response = await (this.options.fetcher ?? fetch)("/jeu/chat/messages/translations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageIds: batch.map((message) => message.id), targetLocale: this.options.targetLocale }),
        signal: this.controller.signal,
      });
      const body = await response.json();
      if (!response.ok || !Array.isArray(body.translations)) throw new Error("Translation unavailable");
      const results = body.translations as TranslationResponse[];
      for (const message of batch) {
        if (this.stopped || this.key(this.messages.get(message.id) ?? message) !== this.key(message) || !this.messages.has(message.id)) continue;
        const result = results.find((item) => item.messageId === message.id);
        if (result?.status === "loaded" && typeof result.translation?.translatedText === "string") {
          this.options.onState(message.id, { ...this.state("loaded", message), ...result.translation,
            visible: result.translation.detectedSourceLocale?.split("-")[0] !== this.options.targetLocale
              && result.translation.translatedText.trim() !== message.message.trim() });
        } else {
          this.options.onState(message.id, this.state("error", message));
          if (result?.status === "busy" && !this.busyRetried.has(this.key(message))) {
            this.busyRetried.add(this.key(message));
            this.attempted.delete(this.key(message));
            this.nextRequestAt = Date.now() + 10_000;
          }
          if (result && ["quota", "budget", "unavailable"].includes(result.status)) this.pause();
        }
      }
    } catch {
      if (!this.stopped) {
        for (const message of batch) {
          if (this.messages.has(message.id) && this.key(this.messages.get(message.id)!) === this.key(message)) this.options.onState(message.id, this.state("error", message));
        }
        this.pause();
      }
    } finally {
      clearTimeout(timeout);
      this.controller = null;
      this.running = false;
      this.nextRequestAt = Math.max(this.nextRequestAt, Date.now() + 2_000);
      this.wake();
    }
  }
  private state(status: ChatMessageTranslationState["status"], message: AutoTranslationMessage): ChatMessageTranslationState {
    return { targetLocale: this.options.targetLocale, status, translatedText: null, detectedSourceLocale: null, error: null, visible: false, sourceKey: this.key(message) };
  }
  private pause() { if (!this.paused) { this.paused = true; this.options.onPause(); } }
}
