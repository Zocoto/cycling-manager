"use server";

import {
  extractGlobalChatPreviewReference,
  GLOBAL_CHAT_MESSAGE_MAX_LENGTH,
  normalizeGlobalChatMessage,
} from "@/lib/game/global-chat";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  mapGlobalChatMessage,
  type GlobalChatMessage,
  type GlobalChatMessageRow,
} from "@/services/global-chat";

export async function postGlobalChatMessageAction(
  rawMessage: string,
): Promise<GlobalChatMessage> {
  const message = normalizeGlobalChatMessage(rawMessage);

  if (
    message.length < 1 ||
    message.length > GLOBAL_CHAT_MESSAGE_MAX_LENGTH
  ) {
    throw new Error(
      `Le message doit contenir entre 1 et ${GLOBAL_CHAT_MESSAGE_MAX_LENGTH} caractères.`,
    );
  }

  const preview = extractGlobalChatPreviewReference(message);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    throw new Error("Vous devez être connecté pour écrire dans le chat.");
  }

  const { data, error } = await supabase.rpc(
    "post_global_chat_message",
    {
      p_message: message,
      p_preview_type: preview?.type ?? null,
      p_preview_entity_id: preview?.entityId ?? null,
    },
  );
  const row = data as GlobalChatMessageRow | null;

  if (error || !row) {
    throw new Error(
      error?.message ??
        "Le message n’a pas pu être envoyé. Réessayez dans un instant.",
    );
  }

  return mapGlobalChatMessage(row);
}
