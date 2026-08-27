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
import { getMobileMoreNavigationGroups } from "@/lib/game/mobile-navigation";

const PRIMARY_LINKS_FR = [
  ["Bureau", "/jeu", "home"],
  ["Effectif", "/jeu/effectif", "riders"],
  ["Transferts", "/jeu/transferts", "transfer"],
] as const;

const PRIMARY_LINKS_EN = [
  ["Office", "/jeu", "home"],
  ["Roster", "/jeu/effectif", "riders"],
  ["Transfers", "/jeu/transferts", "transfer"],
] as const;

const COURSE_LINKS_FR = [
  {
    label: "Inscriptions",
    eyebrow: "1 · Planifier",
    description: "Calendrier et choix des épreuves",
    href: "/jeu/calendrier",
    icon: "calendar",
  },
  {
    label: "Préparation",
    eyebrow: "2 · Préparer",
    description: "Sélection, matériel et stratégie",
    href: "/jeu/preparation-course",
    icon: "prepare",
  },
  {
    label: "Résultats & replays",
    eyebrow: "3 · Suivre",
    description: "Live, classements et rediffusions",
    href: "/jeu/resultats",
    icon: "results",
  },
] as const;

const COURSE_LINKS_EN = [
  {
    label: "Registrations",
    eyebrow: "1 · Plan",
    description: "Calendar and race selection",
    href: "/jeu/calendrier",
    icon: "calendar",
  },
  {
    label: "Preparation",
    eyebrow: "2 · Prepare",
    description: "Line-up, equipment and strategy",
    href: "/jeu/preparation-course",
    icon: "prepare",
  },
  {
    label: "Results & replays",
    eyebrow: "3 · Follow",
    description: "Live coverage, standings and replays",
    href: "/jeu/resultats",
    icon: "results",
  },
] as const;

const COURSE_PATH_PREFIXES = [
  "/jeu/calendrier",
  "/jeu/preparation-course",
  "/jeu/resultats",
  "/jeu/courses",
  "/jeu/championnats-nationaux",
  "/jeu/selections-internationales",
] as const;

type MobilePanel = "races" | "more";

export function MobileGameNavigation({
  viewerEmail,
}: {
  viewerEmail?: string | null;
}) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const pathname = usePathname();
  const panelId = useId();
  const raceTriggerRef = useRef<HTMLButtonElement>(null);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [openState, setOpenState] = useState<{
    panel: MobilePanel;
    pathname: string;
  } | null>(null);
  const [expandedGroupIndexes, setExpandedGroupIndexes] = useState<
    ReadonlySet<number>
  >(() => new Set([0]));

  const groups = getMobileMoreNavigationGroups(
    isEnglish ? NAVIGATION_GROUPS_EN : NAVIGATION_GROUPS_FR,
  );
  const primaryLinks = isEnglish ? PRIMARY_LINKS_EN : PRIMARY_LINKS_FR;
  const courseLinks = isEnglish ? COURSE_LINKS_EN : COURSE_LINKS_FR;
  const showPlayerTracking = canAccessPlayerTracking(viewerEmail);
  const openPanel = openState?.pathname === pathname ? openState.panel : null;
  const racesActive = COURSE_PATH_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );

  useEffect(() => {
    if (!openPanel) return;

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpenState(null);
      const trigger =
        openPanel === "races" ? raceTriggerRef.current : moreTriggerRef.current;
      trigger?.focus();
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [openPanel]);

  function togglePanel(panel: MobilePanel) {
    setOpenState((current) =>
      current?.pathname === pathname && current.panel === panel
        ? null
        : { panel, pathname },
    );
  }

  function closePanel(restoreFocus = false) {
    const panelToRestore = openPanel;
    setOpenState(null);

    if (!restoreFocus || !panelToRestore) return;

    window.requestAnimationFrame(() => {
      const trigger =
        panelToRestore === "races"
          ? raceTriggerRef.current
          : moreTriggerRef.current;
      trigger?.focus();
    });
  }

  return (
    <>
      {openPanel ? (
        <button
          type="button"
          aria-label={
            openPanel === "races"
              ? isEnglish
                ? "Close race center"
                : "Fermer le centre de course"
              : isEnglish
                ? "Close game menu"
                : "Fermer le menu du jeu"
          }
          onClick={() => closePanel(true)}
          className="mobile-app-backdrop fixed inset-0 z-[112] bg-[#071A17]/58 backdrop-blur-[1px] sm:hidden"
        />
      ) : null}

      {openPanel === "races" ? (
        <section
          id={`${panelId}-races`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${panelId}-races-title`}
          data-mobile-panel="races"
          className="mobile-app-sheet fixed inset-x-2 z-[124] overflow-hidden rounded-[1.35rem] border border-[#78947D]/35 bg-[#102D27] text-[#FFFDF4] shadow-[0_24px_80px_rgba(0,0,0,0.46)] sm:hidden"
        >
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/20"
          />
          <header className="flex items-start justify-between gap-3 border-b border-white/10 bg-[#071A17] px-4 pb-3 pt-5">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#7CCF9C]">
                {isEnglish ? "Race workflow" : "Parcours de course"}
              </p>
              <h2
                id={`${panelId}-races-title`}
                className="mt-0.5 text-lg font-black"
              >
                {isEnglish ? "Race center" : "Centre de course"}
              </h2>
              <p className="mt-0.5 text-[11px] font-medium text-[#B9CBC4]">
                {isEnglish
                  ? "Plan, prepare, then follow every race."
                  : "Planifiez, préparez, puis suivez chaque course."}
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => closePanel(true)}
              aria-label={
                isEnglish ? "Close race center" : "Fermer le centre de course"
              }
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/5 text-lg font-black text-[#D6DFD2] transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
            >
              ×
            </button>
          </header>

          <nav
            aria-label={isEnglish ? "Race center" : "Centre de course"}
            className="space-y-2 p-3"
          >
            {courseLinks.map((item) => {
              const active = pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetchOnIntent
                  showPendingIndicator={false}
                  aria-current={active ? "page" : undefined}
                  data-course-destination={item.icon}
                  onClick={() => closePanel()}
                  className={`group flex min-h-[4.4rem] items-center gap-3 rounded-xl border px-3 py-2.5 transition active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C] ${
                    active
                      ? "border-[#F2C94C]/55 bg-[#F2C94C]/12"
                      : "border-white/10 bg-white/[0.055] active:bg-white/10"
                  }`}
                >
                  <span
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                      active
                        ? "bg-[#F2C94C] text-[#071A17]"
                        : "bg-[#1B463C] text-[#9BE0CA]"
                    }`}
                  >
                    <CourseNavigationIcon icon={item.icon} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[9px] font-black uppercase tracking-[0.13em] text-[#7CCF9C]">
                      {item.eyebrow}
                    </span>
                    <span className="mt-0.5 block text-sm font-black text-[#FFFDF4]">
                      {item.label}
                    </span>
                    <span className="block truncate text-[10px] font-medium text-[#B9CBC4]">
                      {item.description}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`text-lg font-black ${
                      active ? "text-[#F2C94C]" : "text-[#78947D]"
                    }`}
                  >
                    {active ? "✓" : "›"}
                  </span>
                </Link>
              );
            })}
          </nav>
        </section>
      ) : null}

      {openPanel === "more" ? (
        <section
          id={`${panelId}-more`}
          role="dialog"
          aria-modal="true"
          aria-label={isEnglish ? "Game menu" : "Menu du jeu"}
          data-mobile-panel="more"
          className="mobile-app-sheet fixed inset-x-2 z-[124] flex max-h-[min(72dvh,42rem)] flex-col overflow-hidden rounded-[1.35rem] border border-[#78947D]/35 bg-[#102D27] text-[#FFFDF4] shadow-[0_24px_80px_rgba(0,0,0,0.46)] sm:hidden"
        >
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/20"
          />
          <header className="flex shrink-0 items-center justify-end border-b border-white/10 bg-[#071A17] px-3 pb-2 pt-4">
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => closePanel(true)}
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
                      prefetchOnIntent
                      showPendingIndicator={false}
                      data-mobile-more-destination={href}
                      onClick={() => closePanel()}
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
                prefetchOnIntent
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
        className="mobile-game-navigation-dock fixed inset-x-2 z-[120] grid grid-cols-5 overflow-hidden rounded-[1.15rem] border border-[#78947D]/35 bg-[#071A17]/96 px-1 text-[#D6DFD2] shadow-[0_14px_42px_rgba(0,0,0,0.38)] backdrop-blur-md sm:hidden"
      >
        {primaryLinks.slice(0, 2).map(([label, href, icon]) => {
          const active = href === "/jeu" ? pathname === href : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              prefetchOnIntent
              showPendingIndicator={false}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[9px] font-black transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C] ${
                active ? "bg-white/10 text-[#F2C94C]" : "text-[#C6D4CE]"
              }`}
            >
              {active ? (
                <span className="absolute inset-x-auto top-0 h-0.5 w-5 rounded-full bg-[#F2C94C]" />
              ) : null}
              <MobileNavigationIcon icon={icon} />
              <span className="max-w-full truncate px-1">{label}</span>
            </Link>
          );
        })}

        <button
          ref={raceTriggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={openPanel === "races"}
          aria-controls={`${panelId}-races`}
          aria-current={racesActive ? "page" : undefined}
          aria-label={isEnglish ? "Open race center" : "Ouvrir le centre de course"}
          onClick={() => togglePanel("races")}
          className={`relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[9px] font-black transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C] ${
            openPanel === "races"
              ? "bg-[#F2C94C] text-[#071A17]"
              : racesActive
                ? "bg-white/10 text-[#F2C94C]"
                : "text-[#C6D4CE]"
          }`}
        >
          {racesActive && openPanel !== "races" ? (
            <span className="absolute inset-x-auto top-0 h-0.5 w-5 rounded-full bg-[#F2C94C]" />
          ) : null}
          <span className="relative">
            <MobileNavigationIcon icon="calendar" />
            <span
              aria-hidden="true"
              className="absolute -right-2 -top-1 text-[8px] leading-none"
            >
              ⌃
            </span>
          </span>
          <span>{isEnglish ? "Races" : "Courses"}</span>
        </button>

        {primaryLinks.slice(2).map(([label, href, icon]) => {
          const active = pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              prefetchOnIntent
              showPendingIndicator={false}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[9px] font-black transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C] ${
                active ? "bg-white/10 text-[#F2C94C]" : "text-[#C6D4CE]"
              }`}
            >
              {active ? (
                <span className="absolute inset-x-auto top-0 h-0.5 w-5 rounded-full bg-[#F2C94C]" />
              ) : null}
              <MobileNavigationIcon icon={icon} />
              <span className="max-w-full truncate px-1">{label}</span>
            </Link>
          );
        })}

        <button
          ref={moreTriggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={openPanel === "more"}
          aria-controls={`${panelId}-more`}
          onClick={() => togglePanel("more")}
          className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[9px] font-black transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C] ${
            openPanel === "more" ? "bg-[#F2C94C] text-[#071A17]" : "text-[#C6D4CE]"
          }`}
        >
          <MobileNavigationIcon icon="menu" />
          <span>{isEnglish ? "More" : "Plus"}</span>
        </button>
      </nav>
    </>
  );
}

function CourseNavigationIcon({
  icon,
}: {
  icon: "calendar" | "prepare" | "results";
}) {
  const commonProps = {
    "aria-hidden": true,
    viewBox: "0 0 24 24",
    fill: "none",
    className: "h-5 w-5",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (icon === "calendar") {
    return <svg {...commonProps}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M8 14h3M14 14h2M8 18h2" /></svg>;
  }

  if (icon === "prepare") {
    return <svg {...commonProps}><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M7 14v6" /><circle cx="14" cy="7" r="2" /><circle cx="7" cy="17" r="2" /></svg>;
  }

  return <svg {...commonProps}><path d="M4 19V9M10 19V5M16 19v-7M22 19V3" /><path d="m3 6 6-3 6 5 7-6" /></svg>;
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
