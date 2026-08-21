"use client";

import Link from "@/components/ui/app-link";
import { useGameHeaderIndicators } from "@/components/game/game-header-indicators-provider";

export function DirectorMailboxShortcut({
  mailboxIsOpen = false,
}: {
  mailboxIsOpen?: boolean;
}) {
  const unreadCount =
    useGameHeaderIndicators()?.mailboxUnreadCount ?? 0;

  const label =
    unreadCount > 0
      ? `Ouvrir la boîte mail · ${unreadCount} message${
          unreadCount > 1 ? "s" : ""
        } non lu${unreadCount > 1 ? "s" : ""}`
      : "Ouvrir la boîte mail";

  return (
    <Link
      href="/jeu/messagerie"
      title={label}
      aria-label={label}
      aria-current={mailboxIsOpen ? "page" : undefined}
      data-mailbox-unread={unreadCount > 0 ? "true" : "false"}
      className={`group relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)] sm:h-10 sm:w-10 ${
        mailboxIsOpen || unreadCount > 0
          ? "border-[var(--game-header-accent)] bg-[var(--game-header-accent-soft)] text-[var(--game-header-accent)]"
          : "border-[#D6DFD2]/25 bg-white/5 text-[#D6DFD2] hover:border-[var(--game-header-accent)] hover:text-[var(--game-header-accent)]"
      }`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        className="h-[18px] w-[18px]"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2.5" y="4" width="15" height="12" rx="2" />
        <path d="m3.5 5.5 6.5 5 6.5-5" />
      </svg>

      {unreadCount > 0 ? (
        <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full border-2 border-[#071A17] bg-[#EF5B65] px-1 text-center text-[9px] font-black leading-4 text-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
