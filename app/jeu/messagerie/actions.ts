"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const messageIdSchema = z.string().uuid();
const skipAutomaticReadCookie = "director_mailbox_skip_read";

export async function markAllDirectorMessagesReadAction() {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(
    "mark_all_current_director_messages_read",
  );

  if (error) {
    throw new Error(
      `Impossible de marquer les messages comme lus : ${error.message}`,
    );
  }

  revalidateMailbox();
}

export async function markDirectorMessageUnreadAction(formData: FormData) {
  const messageId = readMessageId(formData);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(
    "mark_current_director_message_unread",
    { p_message_id: messageId },
  );

  if (error) {
    throw new Error(
      `Impossible de marquer le message comme non lu : ${error.message}`,
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(skipAutomaticReadCookie, messageId, {
    path: "/jeu/messagerie",
    maxAge: 60,
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  revalidateMailbox();
}

export async function archiveDirectorMessageAction(formData: FormData) {
  await setMessageArchived(formData, true);
}

export async function restoreDirectorMessageAction(formData: FormData) {
  await setMessageArchived(formData, false);
}

async function setMessageArchived(formData: FormData, archived: boolean) {
  const messageId = readMessageId(formData);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(
    "set_current_director_message_archived",
    {
      p_message_id: messageId,
      p_archived: archived,
    },
  );

  if (error) {
    throw new Error(
      `Impossible de ${archived ? "classer" : "restaurer"} le message : ${error.message}`,
    );
  }

  revalidateMailbox();
}

function readMessageId(formData: FormData) {
  const result = messageIdSchema.safeParse(formData.get("messageId"));
  if (!result.success) throw new Error("Message invalide.");
  return result.data;
}

function revalidateMailbox() {
  revalidatePath("/jeu/messagerie");
  revalidatePath("/jeu");
}
