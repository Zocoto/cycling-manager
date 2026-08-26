"use server";

import {
  extractGlobalChatPreviewReference,
  GLOBAL_CHAT_MENTION_MAX_RECIPIENTS,
  GLOBAL_CHAT_MESSAGE_MAX_LENGTH,
  hasForbiddenGlobalChatLink,
  isGlobalChatMessageReactionEmoji,
  normalizeGlobalChatMessage,
  type GlobalChatMessageReactionEmoji,
} from "@/lib/game/global-chat";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  mapGlobalChatMessage,
  type GlobalChatMessage,
  type GlobalChatMessageRow,
} from "@/services/global-chat";
import { resolveGlobalChatPreviewPalette } from "@/services/global-chat-preview";

export async function postGlobalChatMessageAction(
  rawMessage: string,
  replyToMessageId: string | null = null,
  mentionedSportingDirectorIds: string[] = [],
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
  if (replyToMessageId !== null && !isUuid(replyToMessageId)) {
    throw new Error("Le message auquel vous répondez est invalide.");
  }
  if (hasForbiddenGlobalChatLink(message)) {
    throw new Error(
      "Seuls les liens Cyclo Stratège vers une fiche coureur, équipe ou DS sont autorisés.",
    );
  }

  const uniqueMentionIds = [...new Set(mentionedSportingDirectorIds)];
  if (
    uniqueMentionIds.length > GLOBAL_CHAT_MENTION_MAX_RECIPIENTS ||
    uniqueMentionIds.some((directorId) => !isUuid(directorId))
  ) {
    throw new Error("Les membres à notifier sont invalides.");
  }

  const preview = extractGlobalChatPreviewReference(message);
  const supabase = await createSupabaseServerClient();
  await requireAuthenticatedUser(supabase);
  const previewPalette = preview
    ? await resolvePreviewPaletteWithoutBlockingMessage(preview)
    : null;

  const { data, error } = await supabase.rpc(
    "post_global_chat_message_v4",
    {
      p_message: message,
      p_preview_type: preview?.type ?? null,
      p_preview_entity_identifier: preview?.entityId ?? null,
      p_reply_to_message_id: replyToMessageId,
      p_mentioned_sporting_director_ids: uniqueMentionIds,
      p_preview_team_primary_color:
        previewPalette?.primaryColor ?? null,
      p_preview_team_secondary_color:
        previewPalette?.secondaryColor ?? null,
      p_preview_team_accent_color: previewPalette?.accentColor ?? null,
      p_preview_jersey_pattern: previewPalette?.jerseyPattern ?? null,
      p_preview_jersey_status: previewPalette?.jerseyStatus ?? null,
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

export async function editGlobalChatMessageAction(
  messageId: string,
  rawMessage: string,
): Promise<GlobalChatMessage> {
  if (!isUuid(messageId)) {
    throw new Error("Ce message est invalide.");
  }

  const message = normalizeGlobalChatMessage(rawMessage);
  if (
    message.length < 1 ||
    message.length > GLOBAL_CHAT_MESSAGE_MAX_LENGTH
  ) {
    throw new Error(
      `Le message doit contenir entre 1 et ${GLOBAL_CHAT_MESSAGE_MAX_LENGTH} caractères.`,
    );
  }
  if (hasForbiddenGlobalChatLink(message)) {
    throw new Error(
      "Seuls les liens Cyclo Stratège vers une fiche coureur, équipe ou DS sont autorisés.",
    );
  }

  const preview = extractGlobalChatPreviewReference(message);
  const supabase = await createSupabaseServerClient();
  await requireAuthenticatedUser(supabase);
  const { data, error } = await supabase.rpc(
    "edit_current_global_chat_message",
    {
      p_message_id: messageId,
      p_message: message,
      p_preview_type: preview?.type ?? null,
      p_preview_entity_identifier: preview?.entityId ?? null,
    },
  );
  const row = data as GlobalChatMessageRow | null;

  if (error || !row) {
    throw new Error(
      error?.message ?? "Le message n’a pas pu être modifié.",
    );
  }

  return mapGlobalChatMessage(row);
}

async function resolvePreviewPaletteWithoutBlockingMessage(
  preview: NonNullable<ReturnType<typeof extractGlobalChatPreviewReference>>,
) {
  try {
    return await resolveGlobalChatPreviewPalette(preview);
  } catch (error) {
    console.error(
      "Global chat preview palette unavailable; using database colors.",
      error,
    );
    return null;
  }
}

export async function toggleGlobalChatMessageReactionAction(
  messageId: string,
  emoji: GlobalChatMessageReactionEmoji,
) {
  if (!isUuid(messageId) || !isGlobalChatMessageReactionEmoji(emoji)) {
    throw new Error("Cette réaction est invalide.");
  }

  const supabase = await createSupabaseServerClient();
  await requireAuthenticatedUser(supabase);
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

async function requireAuthenticatedUser(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Vous devez être connecté pour utiliser le chat.");
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
