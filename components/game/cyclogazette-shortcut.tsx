"use client";

import Link from "@/components/ui/app-link";
import { useGameHeaderIndicators } from "@/components/game/game-header-indicators-provider";

export function CyclogazetteShortcut({
  gazetteIsOpen = false,
}: {
  gazetteIsOpen?: boolean;
}) {
  const hasUnread =
    useGameHeaderIndicators()?.hasUnreadCyclogazette ?? false;
  const displayedUnread = gazetteIsOpen ? false : hasUnread;

  const label = displayedUnread
    ? "Lire La Cyclogazette · nouvelle édition disponible"
    : "Lire La Cyclogazette";

  return (
    <Link
      href="/jeu/gazette"
      title={label}
      aria-label={label}
      data-gazette-unread={displayedUnread ? "true" : "false"}
      className={`group relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)] sm:h-10 sm:w-10 ${
        displayedUnread
          ? "border-[var(--game-header-accent)] bg-[var(--game-header-accent-soft)] text-[var(--game-header-accent)] shadow-[0_0_18px_var(--game-header-accent-soft)]"
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
        <path d="M3 4.5h11.5v11H4.5A1.5 1.5 0 0 1 3 14V4.5Z" />
        <path d="M14.5 7H17v7a1.5 1.5 0 0 1-1.5 1.5h-1" />
        <path d="M5.5 7h3v3h-3zM10 7h2.5M10 9h2.5M5.5 12h7" />
      </svg>
      {displayedUnread ? (
        <span
          aria-hidden="true"
          className="absolute right-1 top-1 h-2 w-2 rounded-full border border-[#071A17] bg-[#F2C94C] shadow-[0_0_0_3px_rgba(242,201,76,0.2)] motion-safe:animate-pulse"
        />
      ) : null}
    </Link>
  );
}
