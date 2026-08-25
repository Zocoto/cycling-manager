export const DIRECT_MESSAGES_CHANGED_EVENT =
  "cyclo-stratege:direct-messages-changed";

export function notifyDirectMessagesChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DIRECT_MESSAGES_CHANGED_EVENT));
}
