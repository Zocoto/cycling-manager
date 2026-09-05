import "server-only";

import { createHash } from "node:crypto";

import { CHAT_TRANSLATION_RATE_LIMIT_PER_HOUR } from "@/lib/game/chat-translation";
import type { ChatTranslationTargetLocale } from "@/lib/game/chat-translation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  ChatTranslationProviderError,
  translateChatText,
} from "@/services/chat-translation-provider";

type CachedTranslationRow = {
  source_fingerprint: string;
  translated_message: string;
  detected_source_locale: string | null;
  provider: string;
};

export type GlobalChatTranslation = {
  translatedText: string;
  detectedSourceLocale: string | null;
  targetLocale: ChatTranslationTargetLocale;
  cached: boolean;
};

export class ChatTranslationRateLimitError extends Error {
  constructor() {
    super("Trop de traductions ont été demandées. Réessaie dans une heure.");
    this.name = "ChatTranslationRateLimitError";
  }
}

export async function getOrCreateGlobalChatTranslation({
  messageId,
  sourceMessage,
  sourceEditedAt,
  targetLocale,
  requesterDirectorId,
  vercelOidcToken,
}: {
  messageId: string;
  sourceMessage: string;
  sourceEditedAt: string | null;
  targetLocale: ChatTranslationTargetLocale;
  requesterDirectorId: string;
  vercelOidcToken?: string;
}): Promise<GlobalChatTranslation> {
  const admin = createSupabaseAdminClient();
  const fingerprint = createSourceFingerprint(sourceMessage, sourceEditedAt);
  const cachedResult = await admin
    .from("global_chat_message_translations")
    .select(
      "source_fingerprint, translated_message, detected_source_locale, provider",
    )
    .eq("message_id", messageId)
    .eq("target_locale", targetLocale)
    .maybeSingle();

  if (cachedResult.error) {
    throw new Error("Impossible de consulter le cache de traduction.");
  }

  const cached = cachedResult.data as CachedTranslationRow | null;
  if (cached?.source_fingerprint === fingerprint) {
    return {
      translatedText: cached.translated_message,
      detectedSourceLocale: cached.detected_source_locale,
      targetLocale,
      cached: true,
    };
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1_000).toISOString();
  const requestsResult = await admin
    .from("global_chat_translation_requests")
    .select("id", { count: "exact", head: true })
    .eq("sporting_director_id", requesterDirectorId)
    .gte("created_at", oneHourAgo);

  if (requestsResult.error) {
    throw new Error("Impossible de vérifier la limite de traduction.");
  }
  if ((requestsResult.count ?? 0) >= CHAT_TRANSLATION_RATE_LIMIT_PER_HOUR) {
    throw new ChatTranslationRateLimitError();
  }

  const requestResult = await admin
    .from("global_chat_translation_requests")
    .insert({
      sporting_director_id: requesterDirectorId,
      message_id: messageId,
      target_locale: targetLocale,
    });
  if (requestResult.error) {
    throw new Error("Impossible d’enregistrer la demande de traduction.");
  }

  const translation = await translateChatText({
    message: sourceMessage,
    targetLocale,
    vercelOidcToken,
  });
  const cacheResult = await admin
    .from("global_chat_message_translations")
    .upsert(
      {
        message_id: messageId,
        target_locale: targetLocale,
        source_fingerprint: fingerprint,
        translated_message: translation.translatedText,
        detected_source_locale: translation.detectedSourceLocale,
        provider: translation.provider,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "message_id,target_locale" },
    );

  if (cacheResult.error) {
    console.error(
      "Global chat translation cache write failed.",
      cacheResult.error,
    );
  }

  return {
    translatedText: translation.translatedText,
    detectedSourceLocale: translation.detectedSourceLocale,
    targetLocale,
    cached: false,
  };
}

export function isChatProviderFailure(error: unknown) {
  return error instanceof ChatTranslationProviderError;
}

function createSourceFingerprint(message: string, editedAt: string | null) {
  return createHash("sha256")
    .update(`${editedAt ?? "original"}\u0000${message}`, "utf8")
    .digest("hex");
}
