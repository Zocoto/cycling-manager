export const DIRECTOR_MAILBOX_CHANGED_EVENT =
  "cyclo-stratege:director-mailbox-changed";

export function notifyDirectorMailboxChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DIRECTOR_MAILBOX_CHANGED_EVENT));
}
