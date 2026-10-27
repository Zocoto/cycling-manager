import { afterEach, describe, expect, it, vi } from "vitest";
import { requestKlipyPage } from "./klipy-request";
import { buildKlipySearchUrl, registerKlipyShare, type ChatGifAttachment } from "./chat-gifs";

const anyDescriptor = Object.getOwnPropertyDescriptor(AbortSignal, "any")!;
const timeoutDescriptor = Object.getOwnPropertyDescriptor(AbortSignal, "timeout")!;
const media: ChatGifAttachment = {
  provider: "klipy", kind: "gif", id: "123", slug: "victory", title: "Bravo",
  url: "https://static.klipy.com/media/victory.gif?delivery=keep",
  previewUrl: "https://static1.klipy.com/media/victory.jpg", width: 320, height: 240,
};
const payload = { result: true, data: { data: [{
  id: 123, slug: media.slug, title: media.title,
  file: { md: { gif: { url: media.url, width: 320, height: 240 } }, xs: { jpg: { url: media.previewUrl } } },
}], has_next: true } };
const url = buildKlipySearchUrl("public-key", "bravo", "gif", 1, "opaque-client");

function olderPhone() {
  Object.defineProperty(AbortSignal, "any", { configurable: true, value: undefined });
  Object.defineProperty(AbortSignal, "timeout", { configurable: true, value: undefined });
}

function pendingFetch() {
  return vi.fn<typeof fetch>((_url, options) => new Promise((_resolve, reject) => {
    options!.signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  }));
}

afterEach(() => {
  Object.defineProperty(AbortSignal, "any", anyDescriptor);
  Object.defineProperty(AbortSignal, "timeout", timeoutDescriptor);
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("mobile KLIPY requests", () => {
  it("loads a real-shaped search without either modern AbortSignal method", async () => {
    olderPhone();
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(payload));
    vi.stubGlobal("fetch", fetcher);
    const result = await requestKlipyPage(url, "gif", new AbortController().signal);
    expect(result).toEqual({ items: [{ key: "123-0", media }], hasNext: true });
    expect(fetcher).toHaveBeenCalledWith(url, { credentials: "omit", signal: expect.any(AbortSignal) });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels the old request when the query changes or the picker closes", async () => {
    olderPhone();
    vi.useFakeTimers();
    const fetcher = pendingFetch();
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();
    const request = requestKlipyPage(url, "gif", controller.signal);
    const rejected = expect(request).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await rejected;
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not start a cancelled request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();
    controller.abort();
    await expect(requestKlipyPage(url, "gif", controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("bounds a slow request without aborting later searches", async () => {
    olderPhone();
    vi.useFakeTimers();
    const fetcher = pendingFetch();
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();
    const rejected = expect(requestKlipyPage(url, "gif", controller.signal)).rejects.toThrow("momentanément indisponibles");
    await vi.advanceTimersByTimeAsync(9999);
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await rejected;
    expect(controller.signal.aborted).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    fetcher.mockResolvedValueOnce(Response.json(payload));
    expect((await requestKlipyPage(url, "gif", controller.signal)).items).toHaveLength(1);
  });

  it("keeps the timeout active while reading the response body", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>(async (_url, options) => ({
      ok: true,
      json: () => new Promise((_resolve, reject) => options!.signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))),
    } as Response));
    vi.stubGlobal("fetch", fetcher);
    const rejected = expect(requestKlipyPage(url, "gif", new AbortController().signal)).rejects.toThrow("momentanément indisponibles");
    await vi.advanceTimersByTimeAsync(10_000);
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([429, 503])("reports HTTP %s and leaves no request timers behind", async (status) => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status })));
    await expect(requestKlipyPage(url, "gif", new AbortController().signal)).rejects.toThrow(status === 429 ? "très sollicitée" : "momentanément indisponibles");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps provider share reporting available on older phones", async () => {
    olderPhone();
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetcher);
    await registerKlipyShare("public-key", media, "opaque-client");
    expect(fetcher).toHaveBeenCalledWith("https://api.klipy.com/api/v1/public-key/gifs/share/victory", expect.objectContaining({
      method: "POST", body: JSON.stringify({ customer_id: "opaque-client" }), signal: expect.any(AbortSignal),
    }));
    expect(vi.getTimerCount()).toBe(0);
  });
});
