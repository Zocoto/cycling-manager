import type { GlobalChatUnreadRefreshTracker } from "@/lib/game/global-chat-read-sync";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function subscribeToGlobalChatUnread({
  refreshTracker,
  readEventName,
  onUnreadChange,
}: {
  refreshTracker: GlobalChatUnreadRefreshTracker;
  readEventName: string;
  onUnreadChange: (hasUnread: boolean) => void;
}) {
  let active = true;
  const supabase = createSupabaseBrowserClient();

  function acknowledgeReadMessages() {
    refreshTracker.invalidate();
    onUnreadChange(false);
  }

  async function refreshUnreadState() {
    const requestVersion = refreshTracker.beginRefresh();
    const { data, error } = await supabase.rpc(
      "has_unread_global_chat_messages",
    );

    if (active && !error && refreshTracker.isCurrent(requestVersion)) {
      onUnreadChange(data === true);
    }
  }

  function refreshWhenVisible() {
    if (document.visibilityState === "visible") {
      void refreshUnreadState();
    }
  }

  window.addEventListener(readEventName, acknowledgeReadMessages);
  window.addEventListener("focus", refreshWhenVisible);
  document.addEventListener("visibilitychange", refreshWhenVisible);

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

  return () => {
    active = false;
    window.removeEventListener(readEventName, acknowledgeReadMessages);
    window.removeEventListener("focus", refreshWhenVisible);
    document.removeEventListener("visibilitychange", refreshWhenVisible);
    void supabase.removeChannel(channel);
  };
}
