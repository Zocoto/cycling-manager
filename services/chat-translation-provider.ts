import "server-only";

import {
  hasTranslatableChatText,
  splitChatMessageForTranslation,
  type ChatTranslationTargetLocale,
} from "@/lib/game/chat-translation";

type DeepLTranslation = {
  detected_source_language?: unknown;
  text?: unknown;
};

type DeepLResponse = {
  translations?: unknown;
};

export type ChatProviderTranslation = {
  translatedText: string;
  detectedSourceLocale: string | null;
  provider: "deepl";
};

export class ChatTranslationProviderError extends Error {
  constructor(
    message = "Le service de traduction est momentanément indisponible.",
  ) {
    super(message);
    this.name = "ChatTranslationProviderError";
  }
}

export function isChatTranslationConfigured() {
  return Boolean(process.env.DEEPL_API_KEY?.trim());
}

export async function translateChatTextWithDeepL({
  message,
  targetLocale,
  apiKey = process.env.DEEPL_API_KEY,
  fetcher = fetch,
}: {
  message: string;
  targetLocale: ChatTranslationTargetLocale;
  apiKey?: string;
  fetcher?: typeof fetch;
}): Promise<ChatProviderTranslation> {
  const normalizedApiKey = apiKey?.trim();
  if (!normalizedApiKey) {
    throw new ChatTranslationProviderError(
      "La traduction automatique n’est pas encore configurée.",
    );
  }

  const segments = splitChatMessageForTranslation(message);
  if (!hasTranslatableChatText(segments)) {
    return {
      translatedText: message,
      detectedSourceLocale: null,
      provider: "deepl",
    };
  }

  const translatableSegments = segments.filter((segment) => segment.translate);
  const endpoint = normalizedApiKey.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";

  let response: Response;
  try {
    response = await fetcher(endpoint, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${normalizedApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: translatableSegments.map((segment) => segment.text),
        target_lang: targetLocale === "en" ? "EN-GB" : "FR",
        preserve_formatting: true,
      }),
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new ChatTranslationProviderError();
  }

  if (!response.ok) {
    throw new ChatTranslationProviderError();
  }

  let payload: DeepLResponse;
  try {
    payload = (await response.json()) as DeepLResponse;
  } catch {
    throw new ChatTranslationProviderError();
  }

  if (!Array.isArray(payload.translations)) {
    throw new ChatTranslationProviderError();
  }

  const translations = payload.translations as DeepLTranslation[];
  if (
    translations.length !== translatableSegments.length ||
    translations.some((translation) => typeof translation.text !== "string")
  ) {
    throw new ChatTranslationProviderError();
  }

  let translationIndex = 0;
  const translatedText = segments
    .map((segment) => {
      if (!segment.translate) return segment.text;
      const translated = translations[translationIndex];
      translationIndex += 1;
      return translated.text as string;
    })
    .join("");

  const longestTranslationIndex = translatableSegments.reduce(
    (longestIndex, segment, index, allSegments) =>
      segment.text.length > allSegments[longestIndex].text.length
        ? index
        : longestIndex,
    0,
  );
  const detectedSourceLanguage =
    translations[longestTranslationIndex]?.detected_source_language;

  return {
    translatedText,
    detectedSourceLocale:
      typeof detectedSourceLanguage === "string"
        ? detectedSourceLanguage.toLowerCase()
        : null,
    provider: "deepl",
  };
}
