import { afterEach, describe, expect, it, vi } from "vitest";
import { translateChatTextBatch } from "./chat-translation-batch-provider";
afterEach(() => vi.unstubAllEnvs());
describe("bounded translation provider batches", () => {
  it("calls Gateway once for a mixed-language batch and preserves protected tokens", async () => {
    vi.stubEnv("DEEPL_API_KEY", ""); vi.stubEnv("AI_GATEWAY_API_KEY", "test");
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)); expect(body.model).toBe("google/gemini-2.5-flash-lite"); expect(body.max_tokens).toBeLessThanOrEqual(2048); expect(body.max_tokens).toBeGreaterThanOrEqual(512);
      expect(body.response_format.type).toBe("json_schema");
      expect(body.response_format.json_schema.schema.properties.translations).toMatchObject({ minItems: 2, maxItems: 2 });
      expect(JSON.parse(body.messages[1].content).segments).toEqual([" Bonjour ", "ciao"]);
      return Response.json({ choices: [{ message: { content: JSON.stringify({ translations: [" Hello ", "hello"], detectedSourceLocales: ["fr", "it"] }) } }] });
    });
    const result = await translateChatTextBatch({ messages: ["[cycling-reaction:sprint] Bonjour @Marco,", "ciao"], targetLocale: "en", fetcher: fetcher as typeof fetch });
    expect(fetcher).toHaveBeenCalledOnce(); expect(result[0].translatedText).toBe("[cycling-reaction:sprint] Hello @Marco,"); expect(result[1].detectedSourceLocale).toBe("it");
  });
  it.each([["ja", "JA"], ["zh", "ZH-HANS"], ["pt", "PT-PT"]] as const)("maps %s for DeepL in one request", async (targetLocale, expected) => {
    vi.stubEnv("DEEPL_API_KEY", "test:fx");
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body)).target_lang).toBe(expected);
      return Response.json({ translations: [{ text: "test", detected_source_language: "EN" }] });
    });
    await translateChatTextBatch({ messages: ["Hello"], targetLocale, fetcher: fetcher as typeof fetch }); expect(fetcher).toHaveBeenCalledOnce();
  });
  it("makes no call for stickers and rejects a malformed response without fallback spending", async () => {
    vi.stubEnv("DEEPL_API_KEY", ""); vi.stubEnv("AI_GATEWAY_API_KEY", "test");
    const fetcher = vi.fn(async () => Response.json({ choices: [] }));
    await translateChatTextBatch({ messages: ["[cycling-reaction:victory] 🎉"], targetLocale: "es", fetcher: fetcher as typeof fetch }); expect(fetcher).not.toHaveBeenCalled();
    await expect(translateChatTextBatch({ messages: ["Hello"], targetLocale: "es", fetcher: fetcher as typeof fetch })).rejects.toThrow(); expect(fetcher).toHaveBeenCalledOnce();
  });
  it("reports only a safe HTTP status, never the provider response body", async () => {
    vi.stubEnv("DEEPL_API_KEY", ""); vi.stubEnv("AI_GATEWAY_API_KEY", "test");
    const fetcher = vi.fn(async () => new Response("provider-sensitive-body", { status: 429 }));
    await expect(translateChatTextBatch({ messages: ["Hello"], targetLocale: "es", fetcher: fetcher as typeof fetch })).rejects.toMatchObject({ reason: "http", providerStatus: 429 });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("identifies a provider timeout without retrying the paid request", async () => {
    vi.stubEnv("DEEPL_API_KEY", ""); vi.stubEnv("AI_GATEWAY_API_KEY", "test");
    const fetcher = vi.fn(async () => { throw new DOMException("timeout", "TimeoutError"); });
    await expect(translateChatTextBatch({ messages: ["Hello"], targetLocale: "es", fetcher: fetcher as typeof fetch })).rejects.toMatchObject({ reason: "timeout" });
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
