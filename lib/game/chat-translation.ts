import type { AppLocale } from "@/lib/i18n/config";

export const CHAT_TRANSLATION_TARGET_LOCALES = ["fr", "en"] as const;
export const CHAT_TRANSLATION_RATE_LIMIT_PER_HOUR = 30;

export type ChatTranslationTargetLocale = AppLocale;

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
