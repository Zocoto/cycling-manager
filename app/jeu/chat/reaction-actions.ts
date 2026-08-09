"use server";

import {
  isGlobalChatMessageReactionEmoji,
  type GlobalChatMessageReactionEmoji,
} from "@/lib/game/global-chat";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function toggleGlobalChatMessageReactionAction(
  messageId: string,
  emoji: GlobalChatMessageReactionEmoji,
) {
  if (!isUuid(messageId) || !isGlobalChatMessageReactionEmoji(emoji)) {
    throw new Error("Cette réaction est invalide.");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    throw new Error("Vous devez être connecté pour réagir dans le chat.");
  }

  const { data, error } = await supabase.rpc(
    "toggle_global_chat_message_reaction",
    {
      p_message_id: messageId,
      p_emoji: emoji,
    },
  );

  if (error) {
    throw new Error(
      error.message || "La réaction n’a pas pu être enregistrée.",
    );
  }

  return { active: Boolean(data) };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
