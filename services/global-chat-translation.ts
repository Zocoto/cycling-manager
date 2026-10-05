import "server-only";
import { createHash } from "node:crypto";
import { CHAT_TRANSLATION_BATCH_SIZE, type ChatTranslationTargetLocale } from "@/lib/game/chat-translation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ChatTranslationProviderError } from "./chat-translation-provider";
import { translateChatTextBatch } from "./chat-translation-batch-provider";

export type GlobalChatTranslation = {
  translatedText: string; detectedSourceLocale: string | null;
  targetLocale: ChatTranslationTargetLocale; cached: boolean;
};
export type TranslationSource = { messageId: string; sourceMessage: string; sourceEditedAt: string | null };
export type BatchTranslationResult = { messageId: string; status: "loaded"; translation: GlobalChatTranslation }
  | { messageId: string; status: "busy" | "quota" | "budget" | "unavailable" };
type Claim = { messageId: string; status: "cached" | "claimed" | "busy" | "quota" | "budget" | "unavailable";
  ticket?: string; translatedText?: string; detectedSourceLocale?: string | null };

export class ChatTranslationRateLimitError extends Error {
  constructor(message = "La limite de traduction est atteinte. Les messages originaux restent disponibles.") {
    super(message); this.name = "ChatTranslationRateLimitError";
  }
}

export async function getOrCreateGlobalChatTranslation(input: TranslationSource & {
  targetLocale: ChatTranslationTargetLocale; requesterDirectorId: string; vercelOidcToken?: string;
}): Promise<GlobalChatTranslation> {
  const [result] = await getOrCreateGlobalChatTranslations({ ...input, sources: [input] });
  if (result?.status === "loaded") return result.translation;
  if (result?.status === "unavailable") throw new ChatTranslationProviderError();
  throw new ChatTranslationRateLimitError(result?.status === "busy" ? "La traduction est déjà en cours. Réessayez dans un instant." : undefined);
}

export async function getOrCreateGlobalChatTranslations({ sources, targetLocale, requesterDirectorId, vercelOidcToken }: {
  sources: TranslationSource[]; targetLocale: ChatTranslationTargetLocale;
  requesterDirectorId: string; vercelOidcToken?: string;
}): Promise<BatchTranslationResult[]> {
  if (!sources.length || sources.length > CHAT_TRANSLATION_BATCH_SIZE) throw new Error("Lot de traduction invalide.");
  const admin = createSupabaseAdminClient();
  const claim = await admin.rpc("claim_global_chat_translation_batch", {
    p_sporting_director_id: requesterDirectorId, p_target_locale: targetLocale,
    p_items: sources.map((source) => ({ message_id: source.messageId,
      source_fingerprint: createHash("sha256").update(`${source.sourceEditedAt ?? "original"}\u0000${source.sourceMessage}`, "utf8").digest("hex"),
      characters: source.sourceMessage.length })),
  });
  if (claim.error || !Array.isArray(claim.data)) throw new Error("La traduction est momentanément indisponible.");
  const claims = claim.data as Claim[];
  const results: BatchTranslationResult[] = claims.filter((item) => item.status !== "claimed").map((item) => item.status === "cached"
    ? { messageId: item.messageId, status: "loaded", translation: { translatedText: item.translatedText!, detectedSourceLocale: item.detectedSourceLocale ?? null, targetLocale, cached: true } }
    : { messageId: item.messageId, status: item.status as "busy" | "quota" | "budget" | "unavailable" });
  const claimed = claims.filter((item) => item.status === "claimed");
  if (!claimed.length) return results;
  const ticket = claimed[0].ticket;
  try {
    const ordered = claimed.map((item) => sources.find((source) => source.messageId === item.messageId)!);
    const translations = await translateChatTextBatch({ messages: ordered.map((source) => source.sourceMessage), targetLocale, vercelOidcToken });
    const completion = await admin.rpc("complete_global_chat_translation_batch", {
      p_ticket: ticket, p_success: true,
      p_results: translations.map((translation, index) => ({ messageId: ordered[index].messageId, ...translation })),
    });
    if (completion.error) throw new Error("Impossible de conserver la traduction.");
    return [...results, ...translations.map((translation, index): BatchTranslationResult => ({
      messageId: ordered[index].messageId, status: "loaded", translation: { ...translation, targetLocale, cached: false },
    }))];
  } catch (error) {
    await admin.rpc("complete_global_chat_translation_batch", { p_ticket: ticket, p_success: false, p_results: [] });
    console.error("Chat translation batch failed.", {
      error: error instanceof Error ? error.name : "UnknownError",
      reason: error instanceof ChatTranslationProviderError ? error.reason : "cache_completion",
      providerStatus: error instanceof ChatTranslationProviderError ? error.providerStatus : undefined,
    });
    return [...results, ...claimed.map((item): BatchTranslationResult => ({ messageId: item.messageId, status: "unavailable" }))];
  }
}

export function isChatProviderFailure(error: unknown): error is ChatTranslationProviderError {
  return error instanceof ChatTranslationProviderError;
}
