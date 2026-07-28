import { describe, expect, it, vi } from "vitest";

import {
  GLOBAL_CHAT_MESSAGES_READ_EVENT,
  GlobalChatUnreadRefreshTracker,
  notifyGlobalChatMessagesRead,
} from "./global-chat-read-sync";

describe("global chat read synchronization", () => {
  it("invalide une réponse non-lue partie avant la confirmation de lecture", () => {
    const tracker = new GlobalChatUnreadRefreshTracker();
    const staleRequest = tracker.beginRefresh();

    tracker.invalidate();

    expect(tracker.isCurrent(staleRequest)).toBe(false);
    expect(tracker.isCurrent(tracker.beginRefresh())).toBe(true);
  });

  it("notifie les raccourcis quand la lecture est confirmée", () => {
    const dispatchEvent = vi.fn<(event: Event) => boolean>(() => true);

    notifyGlobalChatMessagesRead({ dispatchEvent });

    expect(dispatchEvent).toHaveBeenCalledOnce();
    expect(dispatchEvent.mock.calls[0]?.[0].type).toBe(
      GLOBAL_CHAT_MESSAGES_READ_EVENT,
    );
  });
});