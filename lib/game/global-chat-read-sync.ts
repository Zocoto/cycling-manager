export const GLOBAL_CHAT_MESSAGES_READ_EVENT =
  "global-chat:messages-read";

export class GlobalChatUnreadRefreshTracker {
  private version = 0;

  beginRefresh() {
    this.version += 1;
    return this.version;
  }

  invalidate() {
    this.version += 1;
  }

  isCurrent(requestVersion: number) {
    return requestVersion === this.version;
  }
}

export function notifyGlobalChatMessagesRead(
  target: Pick<EventTarget, "dispatchEvent"> = window,
) {
  target.dispatchEvent(new Event(GLOBAL_CHAT_MESSAGES_READ_EVENT));
}