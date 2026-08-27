"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function MobilePageRefreshControl({
  isEnglish,
}: {
  isEnglish: boolean;
}) {
  const router = useRouter();
  const [isRefreshing, startRefreshTransition] = useTransition();
  const label = isEnglish ? "Refresh page" : "Actualiser la page";

  function refreshPage() {
    if (isRefreshing) return;

    startRefreshTransition(() => {
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-busy={isRefreshing}
      data-mobile-page-refresh="true"
      disabled={isRefreshing}
      onClick={refreshPage}
      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#D6DFD2]/25 bg-white/5 text-[var(--game-header-accent)] transition hover:border-[var(--game-header-accent)] hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)] disabled:cursor-wait disabled:opacity-70 sm:hidden"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16 7.5A6.5 6.5 0 1 0 16.1 12" />
        <path d="M16 3.5v4h-4" />
      </svg>
    </button>
  );
}
