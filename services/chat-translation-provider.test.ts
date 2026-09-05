import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ChatTranslationProviderError,
  isChatTranslationConfigured,
  translateChatText,
  translateChatTextWithDeepL,
  translateChatTextWithVercelAiGateway,
} from "./chat-translation-provider";

describe("chat translation providers", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("enables translation with Vercel OIDC even without a DeepL key", () => {
    vi.stubEnv("DEEPL_API_KEY", "");
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "oidc-token");

    expect(isChatTranslationConfigured()).toBe(true);
  });

  it("exposes translation on Vercel where OIDC arrives on each request", () => {
    vi.stubEnv("DEEPL_API_KEY", "");
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "");
    vi.stubEnv("VERCEL", "1");

    expect(isChatTranslationConfigured()).toBe(true);
  });

  it("translates text while preserving chat tokens", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        text: string[];
        target_lang: string;
      };
      expect(body).toEqual({
        text: [" Hello ", " see ", " now"],
        target_lang: "FR",
        preserve_formatting: true,
      });

      return Response.json({
        translations: [
          { detected_source_language: "EN", text: " Bonjour " },
          { detected_source_language: "EN", text: " regarde " },
          { detected_source_language: "EN", text: " maintenant" },
        ],
      });
    });

    const result = await translateChatTextWithDeepL({
      message:
        "[cycling-reaction:sprint] Hello @Jean Dupont, see /jeu/equipes/11111111-1111-4111-8111-111111111111 now",
      targetLocale: "fr",
      apiKey: "test:fx",
      fetcher: fetcher as typeof fetch,
    });

    expect(result).toEqual({
      translatedText:
        "[cycling-reaction:sprint] Bonjour @Jean Dupont, regarde /jeu/equipes/11111111-1111-4111-8111-111111111111 maintenant",
      detectedSourceLocale: "en",
      provider: "deepl",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://api-free.deepl.com/v2/translate",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("does not call the provider for a sticker-only message", async () => {
    const fetcher = vi.fn();
    const result = await translateChatTextWithDeepL({
      message: "[cycling-reaction:victory] 🎉",
      targetLocale: "en",
      apiKey: "test:fx",
      fetcher: fetcher as typeof fetch,
    });

    expect(result.translatedText).toBe("[cycling-reaction:victory] 🎉");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fails without exposing provider details", async () => {
    const fetcher = vi.fn(async () => new Response("secret", { status: 403 }));

    await expect(
      translateChatTextWithDeepL({
        message: "Bonjour",
        targetLocale: "en",
        apiKey: "bad-key",
        fetcher: fetcher as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(ChatTranslationProviderError);
  });

  it("uses AI Gateway as the isolated fallback and preserves chat tokens", async () => {
    const fetcher = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as {
          model: string;
          messages: Array<{ role: string; content: string }>;
          response_format: { type: string };
        };
        const request = JSON.parse(body.messages[1].content) as {
          targetLanguage: string;
          segments: string[];
        };

        expect(body.model).toBe("google/gemini-2.5-flash-lite");
        expect(body.response_format).toEqual({ type: "json_object" });
        expect(request).toEqual({
          targetLanguage: "French",
          segments: [" Hello ", " see ", " now"],
        });

        return Response.json({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  translations: ["Bonjour", "regarde", "maintenant"],
                  detectedSourceLocale: "EN",
                }),
              },
            },
          ],
        });
      },
    );

    const result = await translateChatTextWithVercelAiGateway({
      message:
        "[cycling-reaction:sprint] Hello @Jean Dupont, see /jeu/equipes/11111111-1111-4111-8111-111111111111 now",
      targetLocale: "fr",
      authToken: "oidc-token",
      fetcher: fetcher as typeof fetch,
    });

    expect(result).toEqual({
      translatedText:
        "[cycling-reaction:sprint] Bonjour @Jean Dupont, regarde /jeu/equipes/11111111-1111-4111-8111-111111111111 maintenant",
      detectedSourceLocale: "en",
      provider: "vercel-ai-gateway",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://ai-gateway.vercel.sh/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer oidc-token",
        }),
      }),
    );
  });

  it("prefers DeepL and rejects malformed AI Gateway responses", async () => {
    const deepLFetcher = vi.fn(async () =>
      Response.json({
        translations: [{ detected_source_language: "IT", text: "Salut" }],
      }),
    );

    await expect(
      translateChatText({
        message: "Saluti",
        targetLocale: "fr",
        deepLApiKey: "deepl:fx",
        aiGatewayApiKey: "gateway-token",
        fetcher: deepLFetcher as typeof fetch,
      }),
    ).resolves.toMatchObject({ provider: "deepl" });

    const malformedFetcher = vi.fn(async () =>
      Response.json({
        choices: [{ message: { content: '{"translations":[]}' } }],
      }),
    );
    await expect(
      translateChatTextWithVercelAiGateway({
        message: "Saluti",
        targetLocale: "fr",
        authToken: "oidc-token",
        fetcher: malformedFetcher as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(ChatTranslationProviderError);
  });
});
