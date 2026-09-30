"use client";

import { notifyDirectorMailboxChanged } from "@/lib/game/director-mailbox-sync";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export async function markDirectorMessageRead(messageId: string) {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.rpc(
    "mark_current_director_message_read",
    { p_message_id: messageId },
  );

  if (error) return false;

  notifyDirectorMailboxChanged();
  return true;
}
