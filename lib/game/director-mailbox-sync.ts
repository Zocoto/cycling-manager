export const DIRECTOR_MAILBOX_CHANGED_EVENT =
  "cyclo-stratege:director-mailbox-changed";

export type DirectorMailboxChangedDetail = {
  unreadCount?: number;
};

export function notifyDirectorMailboxChanged(unreadCount?: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<DirectorMailboxChangedDetail>(
      DIRECTOR_MAILBOX_CHANGED_EVENT,
      {
        detail: { unreadCount },
      },
    ),
  );
}
