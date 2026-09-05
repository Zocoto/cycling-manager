import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ChatTranslationProviderError,
  translateChatTextWithDeepL,
} from "./chat-translation-provider";

describe("DeepL chat translation provider", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
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
});
