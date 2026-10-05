export const CHAT_TRANSLATION_LANGUAGES = {
  fr: "Français", en: "English", es: "Español", de: "Deutsch",
  it: "Italiano", pt: "Português", nl: "Nederlands", pl: "Polski",
  ja: "日本語", ko: "한국어", zh: "中文", ar: "العربية",
} as const;
export const CHAT_TRANSLATION_TARGET_LOCALES = Object.keys(CHAT_TRANSLATION_LANGUAGES);
export const CHAT_TRANSLATION_RATE_LIMIT_PER_HOUR = 30;
export const CHAT_TRANSLATION_BATCH_SIZE = 5;
export const CHAT_TRANSLATION_DAILY_CHARACTER_LIMIT = 15_000;
export const CHAT_TRANSLATION_DAILY_GENERATION_LIMIT = 200;

export type ChatTranslationTargetLocale = keyof typeof CHAT_TRANSLATION_LANGUAGES;

export type ChatMessageTranslationState = {
  targetLocale: ChatTranslationTargetLocale;
  status: "loading" | "loaded" | "error";
  translatedText: string | null;
  detectedSourceLocale: string | null;
  error: string | null;
  visible: boolean;
  sourceKey?: string;
};

export function getPreferredChatTranslationLocale(
  browserLanguages: readonly string[],
  fallback: ChatTranslationTargetLocale = "fr",
): ChatTranslationTargetLocale {
  for (const language of browserLanguages) {
    const base = language.toLowerCase().replaceAll("_", "-").split("-")[0];
    if (isChatTranslationTargetLocale(base)) return base;
  }
  return browserLanguages.length ? "en" : fallback;
}

export function getChatTranslationSourceKey(message: { id: string; editedAt: string | null; message: string }) {
  return `${message.id}:${message.editedAt ?? ""}:${message.message}`;
}

export function readChatTranslationPreferences(raw: string | null, browserLanguages: readonly string[], fallback: ChatTranslationTargetLocale) {
  const defaults = { automatic: true, targetLocale: getPreferredChatTranslationLocale(browserLanguages, fallback) };
  try {
    const value = JSON.parse(raw ?? "null");
    if (!value || typeof value !== "object") return defaults;
    return {
      automatic: typeof value.automatic === "boolean" ? value.automatic : defaults.automatic,
      targetLocale: isChatTranslationTargetLocale(value.targetLocale) ? value.targetLocale.toLowerCase() as ChatTranslationTargetLocale : defaults.targetLocale,
    };
  } catch { return defaults; }
}

export type ChatTranslationSegment = {
  text: string;
  translate: boolean;
};

const PROTECTED_CHAT_TOKEN_PATTERN =
  /(\[cycling-reaction:[^\]\r\n]+\]|(?:(?:https:\/\/(?:www\.)?|www\.)?cyclostratege\.fr)?\/jeu\/(?:(?:equipes|coureurs)\/[0-9a-f-]{36}|directeurs-sportifs\/[^/?#\s<>]+)(?:[/?#][^\s<]*)?|@[^@,\n;:!?]{1,30},?)/gi;

export function isChatTranslationTargetLocale(
  value: unknown,
): value is ChatTranslationTargetLocale {
  return (
    typeof value === "string" &&
    CHAT_TRANSLATION_TARGET_LOCALES.includes(
      value.toLowerCase() as ChatTranslationTargetLocale,
    )
  );
}

export function splitChatMessageForTranslation(
  message: string,
): ChatTranslationSegment[] {
  const segments: ChatTranslationSegment[] = [];
  let cursor = 0;

  for (const match of message.matchAll(PROTECTED_CHAT_TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      pushTranslatableSegment(segments, message.slice(cursor, index));
    }
    segments.push({ text: match[0], translate: false });
    cursor = index + match[0].length;
  }

  if (cursor < message.length) {
    pushTranslatableSegment(segments, message.slice(cursor));
  }

  return segments;
}

export function hasTranslatableChatText(
  segments: readonly ChatTranslationSegment[],
) {
  return segments.some((segment) => segment.translate);
}

function pushTranslatableSegment(
  segments: ChatTranslationSegment[],
  text: string,
) {
  if (!text) return;
  segments.push({ text, translate: /\p{L}/u.test(text) });
}
