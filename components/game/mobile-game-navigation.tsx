"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { useLocale } from "@/components/i18n/locale-provider";
import {
  NAVIGATION_GROUPS_EN,
  NAVIGATION_GROUPS_FR,
} from "@/components/game/game-navigation-menu";
import Link from "@/components/ui/app-link";
import { canAccessPlayerTracking } from "@/lib/game/player-tracking-access";

const PRIMARY_LINKS_FR = [
  ["Bureau", "/jeu", "home"],
  ["Effectif", "/jeu/effectif", "riders"],
  ["Courses", "/jeu/calendrier", "calendar"],
  ["Transferts", "/jeu/transferts", "transfer"],
] as const;

const PRIMARY_LINKS_EN = [
  ["Office", "/jeu", "home"],
  ["Roster", "/jeu/effectif", "riders"],
  ["Races", "/jeu/calendrier", "calendar"],
  ["Transfers", "/jeu/transferts", "transfer"],
] as const;

export function MobileGameNavigation({
  viewerEmail,
}: {
  viewerEmail?: string | null;
}) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const pathname = usePathname();
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [openPathname, setOpenPathname] = useState<string | null>(null);
  const [expandedGroupIndexes, setExpandedGroupIndexes] = useState<
    ReadonlySet<number>
  >(() => new Set([0]));

  const groups = isEnglish ? NAVIGATION_GROUPS_EN : NAVIGATION_GROUPS_FR;
  const primaryLinks = isEnglish ? PRIMARY_LINKS_EN : PRIMARY_LINKS_FR;
  const showPlayerTracking = canAccessPlayerTracking(viewerEmail);
  const open = openPathname === pathname;

  useEffect(() => {
    if (!open) return;

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpenPathname(null);
      triggerRef.current?.focus();
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [open]);

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label={isEnglish ? "Close game menu" : "Fermer le menu du jeu"}
          onClick={() => setOpenPathname(null)}
          className="fixed inset-0 z-[112] bg-[#071A17]/58 backdrop-blur-[1px] sm:hidden"
        />
      ) : null}

      {open ? (
        <section
          id={panelId}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${panelId}-title`}
          className="fixed inset-x-2 bottom-[calc(4.65rem+env(safe-area-inset-bottom))] z-[124] flex max-h-[min(72dvh,42rem)] flex-col overflow-hidden rounded-[1.35rem] border border-[#78947D]/35 bg-[#102D27] text-[#FFFDF4] shadow-[0_24px_80px_rgba(0,0,0,0.46)] sm:hidden"
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#071A17] px-4 py-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#7CCF9C]">
                {isEnglish ? "Quick overview" : "Vue d’ensemble"}
              </p>
              <h2 id={`${panelId}-title`} className="mt-0.5 text-base font-black">
                {isEnglish ? "All game sections" : "Toutes les rubriques"}
              </h2>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => {
                setOpenPathname(null);
                triggerRef.current?.focus();
              }}
              aria-label={isEnglish ? "Close game menu" : "Fermer le menu du jeu"}
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-white/5 text-lg font-black text-[#D6DFD2]"
            >
              ×
            </button>
          </header>

          <nav
            aria-label={isEnglish ? "Mobile game navigation" : "Navigation mobile du jeu"}
            className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3"
          >
            {groups.map((group, groupIndex) => (
              <details
                key={group.label}
                open={expandedGroupIndexes.has(groupIndex)}
                onToggle={(event) => {
                  const nextOpen = event.currentTarget.open;
                  setExpandedGroupIndexes((current) => {
                    const next = new Set(current);

                    if (nextOpen) next.add(groupIndex);
                    else next.delete(groupIndex);

                    return next;
                  });
                }}
                className="group rounded-xl border border-white/10 bg-white/[0.045]"
              >
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-xs font-black text-[#EAF4EF] marker:hidden">
                  <span>{group.label}</span>
                  <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.12em] text-[#9BE0CA]">
                    {group.links.length}
                    <span aria-hidden="true" className="transition group-open:rotate-180">
                      ⌄
                    </span>
                  </span>
                </summary>
                <div className="grid grid-cols-2 gap-1 border-t border-white/10 p-2">
                  {group.links.map(([label, href]) => (
                    <Link
                      key={href}
                      href={href}
                      showPendingIndicator={false}
                      className="flex min-h-10 items-center rounded-lg px-2.5 py-2 text-[11px] font-bold leading-4 text-[#FFFDF4] transition active:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </details>
            ))}

            {showPlayerTracking ? (
              <Link
                href="/jeu/suivi-joueurs"
                showPendingIndicator={false}
                className="flex min-h-11 items-center justify-between rounded-xl border border-[#F2C94C]/30 bg-[#F2C94C]/10 px-3 text-xs font-black text-[#FFE58A]"
              >
                {isEnglish ? "Player tracking" : "Suivi des joueurs"}
                <span aria-hidden="true">→</span>
              </Link>
            ) : null}
          </nav>
        </section>
      ) : null}

      <nav
        aria-label={isEnglish ? "Main mobile shortcuts" : "Raccourcis mobiles principaux"}
        className="fixed inset-x-2 bottom-[max(0.45rem,env(safe-area-inset-bottom))] z-[120] grid h-[3.85rem] grid-cols-5 overflow-hidden rounded-[1.15rem] border border-[#78947D]/35 bg-[#071A17]/96 px-1 text-[#D6DFD2] shadow-[0_14px_42px_rgba(0,0,0,0.38)] backdrop-blur-md sm:hidden"
      >
        {primaryLinks.map(([label, href, icon]) => {
          const active = href === "/jeu" ? pathname === href : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              showPendingIndicator={false}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[9px] font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C] ${
                active ? "bg-white/10 text-[#F2C94C]" : "text-[#C6D4CE]"
              }`}
            >
              <MobileNavigationIcon icon={icon} />
              <span className="max-w-full truncate px-1">{label}</span>
            </Link>
          );
        })}

        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() =>
            setOpenPathname((current) =>
              current === pathname ? null : pathname,
            )
          }
          className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[9px] font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C] ${
            open ? "bg-[#F2C94C] text-[#071A17]" : "text-[#C6D4CE]"
          }`}
        >
          <MobileNavigationIcon icon="menu" />
          <span>{isEnglish ? "More" : "Plus"}</span>
        </button>
      </nav>
    </>
  );
}

function MobileNavigationIcon({
  icon,
}: {
  icon: "home" | "riders" | "calendar" | "transfer" | "menu";
}) {
  const commonProps = {
    "aria-hidden": true,
    viewBox: "0 0 24 24",
    fill: "none",
    className: "h-[1.15rem] w-[1.15rem]",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (icon === "home") {
    return <svg {...commonProps}><path d="m3.5 10 8.5-7 8.5 7v10h-6v-6h-5v6h-6V10Z" /></svg>;
  }

  if (icon === "riders") {
    return <svg {...commonProps}><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M2.5 20c.4-4 2.2-6 5.5-6s5.1 2 5.5 6M13.5 15c3.8-.8 6.8 1 7.5 5" /></svg>;
  }

  if (icon === "calendar") {
    return <svg {...commonProps}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M8 14h3M14 14h2M8 18h2" /></svg>;
  }

  if (icon === "transfer") {
    return <svg {...commonProps}><path d="M4 7h14m0 0-3-3m3 3-3 3M20 17H6m0 0 3 3m-3-3 3-3" /></svg>;
  }

  return <svg {...commonProps}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
}
