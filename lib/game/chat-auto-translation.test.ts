import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatAutoTranslationQueue } from "./chat-auto-translation";
import { getPreferredChatTranslationLocale, readChatTranslationPreferences, type ChatMessageTranslationState } from "./chat-translation";

function fixture(fetcher: ReturnType<typeof vi.fn<typeof fetch>> = vi.fn(async () => Response.json({ translations: [] }))) {
  const states: Record<string, ChatMessageTranslationState> = {};
  const onPause = vi.fn();
  const queue = new ChatAutoTranslationQueue({ directorId: "self", targetLocale: "en", fetcher: fetcher as typeof fetch,
    getState: (id) => states[id], onState: (id, state) => { states[id] = state; }, onPause });
  const messages = Array.from({ length: 8 }, (_, i) => ({ id: String(i), sportingDirectorId: "other", message: `Bonjour ${i}`, editedAt: null }));
  queue.setMessages(messages);
  return { queue, states, messages, fetcher, onPause };
}
afterEach(() => vi.useRealTimers());

describe("automatic chat translation cost and isolation", () => {
  it("defaults to checked and browser language, not nationality", () => {
    expect(readChatTranslationPreferences(null, ["es-MX", "en"], "fr")).toEqual({ automatic: true, targetLocale: "es" });
    expect(getPreferredChatTranslationLocale(["unknown", "de-DE"])).toBe("de");
    expect(getPreferredChatTranslationLocale(["sw"], "en")).toBe("en");
    expect(readChatTranslationPreferences('{"automatic":false,"targetLocale":"it"}', ["fr"], "fr")).toEqual({ automatic: false, targetLocale: "it" });
    expect(readChatTranslationPreferences("bad-json", ["ja"], "fr").automatic).toBe(true);
  });
  it("makes no request without visible messages and stops after an idle wake", async () => {
    vi.useFakeTimers(); const f = fixture(); f.queue.wake(); await vi.runAllTimersAsync(); expect(f.fetcher).not.toHaveBeenCalled(); f.queue.dispose();
  });
  it("batches five rows, serializes requests and never polls/retries completed rows", async () => {
    vi.useFakeTimers(); const f = fixture(); f.messages.forEach((m) => f.queue.observe(m.id, true));
    await vi.advanceTimersByTimeAsync(650); expect(f.fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(f.fetcher.mock.calls[0][1]?.body)).messageIds).toHaveLength(5);
    await vi.advanceTimersByTimeAsync(2_000); expect(f.fetcher).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(60_000); expect(f.fetcher).toHaveBeenCalledTimes(2); f.queue.dispose();
  });
  it("excludes own messages, stickers and rows scrolled away before the dwell delay", async () => {
    vi.useFakeTimers(); const f = fixture(); f.queue.setMessages([{ ...f.messages[0], sportingDirectorId: "self" }, { ...f.messages[1], message: "[cycling-reaction:victory] 🎉" }, f.messages[2]]);
    ["0", "1", "2"].forEach((id) => f.queue.observe(id, true)); f.queue.observe("2", false);
    await vi.runAllTimersAsync(); expect(f.fetcher).not.toHaveBeenCalled(); f.queue.dispose();
  });
  it("does not queue already translated messages and does not duplicate original-language text", async () => {
    vi.useFakeTimers(); const f = fixture(vi.fn(async () => Response.json({ translations: [{ messageId: "1", status: "loaded", translation: { translatedText: "Hello", detectedSourceLocale: "en" } }] })));
    f.states["0"] = { targetLocale: "en", status: "loaded", translatedText: "Hello", detectedSourceLocale: "fr", visible: true, error: null };
    f.queue.setMessages([f.messages[0], { ...f.messages[1], message: "Hello" }]); f.queue.observe("0", true); f.queue.observe("1", true);
    await vi.advanceTimersByTimeAsync(650); expect(f.states["1"].visible).toBe(false); expect(JSON.parse(String(f.fetcher.mock.calls[0][1]?.body)).messageIds).toEqual(["1"]); f.queue.dispose();
  });
  it("pauses on provider errors or budgets, without a retry loop", async () => {
    vi.useFakeTimers(); const f = fixture(vi.fn(async () => Response.json({ translations: [{ messageId: "0", status: "budget" }] })));
    f.queue.observe("0", true); await vi.runAllTimersAsync(); f.queue.observe("1", true); await vi.runAllTimersAsync();
    expect(f.fetcher).toHaveBeenCalledTimes(1); expect(f.onPause).toHaveBeenCalledOnce(); expect(f.states["0"].status).toBe("error"); expect(f.states["0"].visible).toBe(false); f.queue.dispose();
  });
  it("cancels before entering private chat or changing language", async () => {
    vi.useFakeTimers(); const f = fixture(); f.queue.observe("0", true); f.queue.dispose(); await vi.runAllTimersAsync(); expect(f.fetcher).not.toHaveBeenCalled();
  });
  it("rechecks a shared in-flight translation only once, after a bounded delay", async () => {
    vi.useFakeTimers(); const f = fixture(vi.fn(async () => Response.json({ translations: [{ messageId: "0", status: "busy" }] })));
    f.queue.observe("0", true); await vi.advanceTimersByTimeAsync(650); expect(f.fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(9_999); expect(f.fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); expect(f.fetcher).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(120_000); expect(f.fetcher).toHaveBeenCalledTimes(2); f.queue.dispose();
  });
  it("ignores a stale provider result after an edit or deletion", async () => {
    vi.useFakeTimers(); let resolve!: (value: Response) => void;
    const f = fixture(vi.fn(() => new Promise<Response>((done) => { resolve = done; })));
    f.queue.observe("0", true); await vi.advanceTimersByTimeAsync(650); f.queue.setMessages([{ ...f.messages[0], message: "Un autre message", editedAt: "now" }]);
    resolve(Response.json({ translations: [{ messageId: "0", status: "loaded", translation: { translatedText: "Hello", detectedSourceLocale: "fr" } }] }));
    await vi.advanceTimersByTimeAsync(1); expect(f.states["0"].status).not.toBe("loaded"); f.queue.dispose();
  });
});
