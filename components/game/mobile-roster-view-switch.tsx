"use client";

import Link from "@/components/ui/app-link";
import {
  ROSTER_MOBILE_VIEW_COOKIE,
  type RosterMobileView,
} from "@/lib/game/roster-mobile-view";
import type {
  RosterSortDirection,
  RosterSortKey,
} from "@/lib/game/roster-sort";

const ONE_YEAR_IN_SECONDS = 31_536_000;

function rememberView(view: RosterMobileView) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${ROSTER_MOBILE_VIEW_COOKIE}=${view}; Path=/; Max-Age=${ONE_YEAR_IN_SECONDS}; SameSite=Lax${secure}`;
}

export function MobileRosterViewSwitch({
  activeView,
  currentSortKey,
  currentDirection,
}: {
  activeView: RosterMobileView;
  currentSortKey: RosterSortKey | null;
  currentDirection: RosterSortDirection;
}) {
  const views = [
    {
      id: "synthese" as const,
      label: "Vue synthèse",
      description: "Comparer 4 notes",
    },
    {
      id: "fiches" as const,
      label: "Fiches détaillées",
      description: "Gérer chaque coureur",
    },
  ];

  return (
    <nav
      aria-label="Affichage mobile de l’effectif"
      className="grid grid-cols-2 gap-1.5 border-b border-[#315B3E]/12 bg-[#F3F8F5] p-2"
    >
      {views.map((view) => {
        const isActive = activeView === view.id;

        return (
          <Link
            key={view.id}
            href={{
              pathname: "/jeu/effectif",
              query: {
                vue: "statistiques",
                mobile: view.id,
                ...(currentSortKey
                  ? {
                      sort: currentSortKey,
                      direction: currentDirection,
                    }
                  : {}),
              },
            }}
            scroll={false}
            onClick={() => rememberView(view.id)}
            aria-current={isActive ? "page" : undefined}
            className={[
              "min-w-0 rounded-xl border px-2 py-2.5 text-center transition",
              isActive
                ? "border-[#278B70] bg-[#D7EEE8] text-[#0F5944] shadow-sm"
                : "border-[#315B3E]/12 bg-white text-[#60756E]",
            ].join(" ")}
          >
            <span className="block truncate text-[11px] font-black">
              {view.label}
            </span>
            <span className="mt-0.5 block truncate text-[9px] font-bold opacity-75">
              {view.description}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
