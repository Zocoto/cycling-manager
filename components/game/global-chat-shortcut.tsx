"use client";

import { useEffect, useState } from "react";

import Link from "@/components/ui/app-link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function GlobalChatShortcut({
  chatIsOpen = false,
  initialHasUnread = false,
}: {
  chatIsOpen?: boolean;
  initialHasUnread?: boolean;
}) {
  const [hasUnread, setHasUnread] = useState(initialHasUnread);
  const displayedUnread = chatIsOpen ? false : hasUnread;

  useEffect(() => {
    if (chatIsOpen) return;

    let active = true;
    const supabase = createSupabaseBrowserClient();

    async function refreshUnreadState() {
      const { data, error } = await supabase.rpc(
        "has_unread_global_chat_messages",
      );

      if (active && !error) {
        setHasUnread(data === true);
      }
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        void refreshUnreadState();
      }
    }

    void refreshUnreadState();

    const channel = supabase
      .channel("global-chat-unread-indicator")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "global_chat_messages",
        },
        () => {
          void refreshUnreadState();
        },
      )
      .subscribe();

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener(
      "visibilitychange",
      refreshWhenVisible,
    );

    return () => {
      active = false;
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener(
        "visibilitychange",
        refreshWhenVisible,
      );
      void supabase.removeChannel(channel);
    };
  }, [chatIsOpen]);

  const label = displayedUnread
    ? "Ouvrir le chat général · nouveaux messages non lus"
    : "Ouvrir le chat général";

  return (
    <Link
      href="/jeu/chat"
      title={label}
      aria-label={label}
      data-chat-unread={displayedUnread ? "true" : "false"}
      className="group relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#D6DFD2]/25 bg-white/5 text-[#D6DFD2] transition hover:border-[var(--game-header-accent)] hover:text-[var(--game-header-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)]"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        className="h-[1.1rem] w-[1.1rem]"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 3.5h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-5 3v-3a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" />
        <path d="M6 9h.01M10 9h.01M14 9h.01" />
      </svg>
      <span
        aria-hidden="true"
        className={`absolute right-1.5 top-1.5 h-2 w-2 rounded-full border border-[#071A17] transition ${
          displayedUnread
            ? "bg-[#EF5B65] shadow-[0_0_0_3px_rgba(239,91,101,0.18)] motion-safe:animate-pulse"
            : "bg-[#42B99A] group-hover:bg-[var(--game-header-accent)]"
        }`}
      />
    </Link>
  );
}
