"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { notifyDirectorMailboxChanged } from "@/lib/game/director-mailbox-sync";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const skipAutomaticReadCookie = "director_mailbox_skip_read";

export function DirectorMailboxReadMarker({
  messageId,
  unread,
}: {
  messageId: string;
  unread: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!unread) return;

    const skippedMessageId = readCookie(skipAutomaticReadCookie);
    if (skippedMessageId === messageId) {
      document.cookie = `${skipAutomaticReadCookie}=; Path=/jeu/messagerie; Max-Age=0; SameSite=Lax`;
      notifyDirectorMailboxChanged();
      return;
    }

    let active = true;
    const supabase = createSupabaseBrowserClient();

    async function markRead() {
      const { error } = await supabase.rpc(
        "mark_current_director_message_read",
        { p_message_id: messageId },
      );
      if (active && !error) {
        notifyDirectorMailboxChanged();
        router.refresh();
      }
    }

    void markRead();
    return () => {
      active = false;
    };
  }, [messageId, router, unread]);

  return null;
}

function readCookie(name: string) {
  const prefix = `${name}=`;
  const item = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return item ? decodeURIComponent(item.slice(prefix.length)) : null;
}
