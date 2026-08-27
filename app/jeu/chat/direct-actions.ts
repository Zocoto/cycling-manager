"use server";

import { after } from "next/server";

import {
  DIRECT_MESSAGE_MAX_LENGTH,
  isUuid,
  normalizeDirectMessage,
} from "@/lib/game/direct-messages";
import { hasForbiddenGlobalChatLink } from "@/lib/game/global-chat";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getDirectConversation,
  mapDirectMessage,
  type DirectConversation,
  type DirectMessage,
  type DirectMessageRow,
} from "@/services/direct-messages";
import { dispatchDuePushNotifications } from "@/services/push-notifications";

export async function openDirectConversationAction(
  recipientId: string,
): Promise<DirectConversation> {
  if (!isUuid(recipientId)) {
    throw new Error("Ce destinataire est invalide.");
  }

  const supabase = await createSupabaseServerClient();
  await requireAuthenticatedUser(supabase);
  const { data, error } = await supabase.rpc(
    "get_or_create_current_direct_conversation",
    { p_recipient_id: recipientId },
  );

  if (error || typeof data !== "string") {
    throw new Error(
      error?.message ?? "La conversation privée n’a pas pu être ouverte.",
    );
  }

  const conversation = await getDirectConversation(supabase, data);
  if (!conversation) {
    throw new Error("La conversation privée est indisponible.");
  }

  return conversation;
}

export async function postDirectMessageAction(
  conversationId: string,
  rawBody: string,
): Promise<DirectMessage> {
  if (!isUuid(conversationId)) {
    throw new Error("Cette conversation privée est invalide.");
  }

  const body = normalizeDirectMessage(rawBody);
  if (body.length < 1 || body.length > DIRECT_MESSAGE_MAX_LENGTH) {
    throw new Error(
      `Le message doit contenir entre 1 et ${DIRECT_MESSAGE_MAX_LENGTH} caractères.`,
    );
  }
  if (hasForbiddenGlobalChatLink(body)) {
    throw new Error(
      "Seuls les liens Cyclo Stratège vers une fiche coureur, équipe ou DS sont autorisés.",
    );
  }

  const supabase = await createSupabaseServerClient();
  await requireAuthenticatedUser(supabase);
  const { data, error } = await supabase.rpc(
    "post_current_direct_message",
    {
      p_conversation_id: conversationId,
      p_body: body,
    },
  );
  const row = data as DirectMessageRow | null;

  if (error || !row) {
    throw new Error(
      error?.message ?? "Le message privé n’a pas pu être envoyé.",
    );
  }

  scheduleDirectMessagePushDispatch();
  return mapDirectMessage(row);
}

export async function editDirectMessageAction(
  messageId: string,
  rawBody: string,
): Promise<DirectMessage> {
  if (!isUuid(messageId)) {
    throw new Error("Ce message privé est invalide.");
  }

  const body = normalizeDirectMessage(rawBody);
  if (body.length < 1 || body.length > DIRECT_MESSAGE_MAX_LENGTH) {
    throw new Error(
      `Le message doit contenir entre 1 et ${DIRECT_MESSAGE_MAX_LENGTH} caractères.`,
    );
  }
  if (hasForbiddenGlobalChatLink(body)) {
    throw new Error(
      "Seuls les liens Cyclo Stratège vers une fiche coureur, équipe ou DS sont autorisés.",
    );
  }

  const supabase = await createSupabaseServerClient();
  await requireAuthenticatedUser(supabase);
  const { data, error } = await supabase.rpc(
    "edit_current_direct_message",
    {
      p_message_id: messageId,
      p_body: body,
    },
  );
  const row = data as DirectMessageRow | null;

  if (error || !row) {
    throw new Error(
      error?.message ?? "Le message privé n’a pas pu être modifié.",
    );
  }

  return mapDirectMessage(row);
}

export async function markDirectConversationReadAction(
  conversationId: string,
) {
  if (!isUuid(conversationId)) {
    throw new Error("Cette conversation privée est invalide.");
  }

  const supabase = await createSupabaseServerClient();
  await requireAuthenticatedUser(supabase);
  const { error } = await supabase.rpc(
    "mark_current_direct_conversation_read",
    { p_conversation_id: conversationId },
  );

  if (error) {
    throw new Error(
      error.message || "La conversation n’a pas pu être marquée comme lue.",
    );
  }
}

async function requireAuthenticatedUser(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  const {
    data: { user },
    error,
  } = await getAuthenticatedUser(supabase);

  if (error || !user) {
    throw new Error("Vous devez être connecté pour utiliser les MP.");
  }
}

function scheduleDirectMessagePushDispatch() {
  after(async () => {
    try {
      await dispatchDuePushNotifications({
        limit: 5,
        enqueueRaceLives: false,
      });
    } catch (error) {
      console.error(
        "Impossible de distribuer immédiatement la notification de message privé.",
        error,
      );
    }
  });
}
