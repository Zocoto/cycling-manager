import Link from "@/components/ui/app-link";

type GameNavigationMenuProps = {
  showRaceSimulator?: boolean;
};

const NAVIGATION_GROUPS = [
  {
    label: "Essentiel",
    links: [
      ["Bureau du DS", "/jeu"],
      ["Mon profil de DS", "/jeu/directeur-sportif"],
      ["Mon équipe", "/jeu/equipe"],
      ["Objectifs et trophées", "/jeu/objectifs"],
    ],
  },
  {
    label: "Sportif",
    links: [
      ["Effectif", "/jeu/effectif"],
      ["Calendrier", "/jeu/calendrier"],
      ["Résultats et replays", "/jeu/resultats"],
      ["Classements", "/jeu/classements"],
      ["Entraînement", "/jeu/entrainement"],
      ["Centre de soin", "/jeu/centre-de-soin"],
      ["Centre de formation", "/jeu/centre-de-formation"],
      ["Sélections internationales", "/jeu/selections-internationales"],
    ],
  },
  {
    label: "Gestion du club",
    links: [
      ["Staff", "/jeu/staff"],
      ["Transferts", "/jeu/transferts"],
      ["Sponsoring", "/jeu/sponsoring"],
      ["Finances", "/jeu/finances"],
      ["Infrastructures", "/jeu/infrastructures"],
      ["Matériel", "/jeu/materiel"],
      ["Équipementiers", "/jeu/materiel/equipementier"],
      ["Inventaire", "/jeu/inventaire"],
      ["Maillot", "/jeu/maillot"],
    ],
  },
  {
    label: "Communauté et aide",
    links: [
      ["Chat du peloton", "/jeu/chat"],
      ["Recherche globale", "/jeu/recherche"],
      ["Guide du jeu", "/guide"],
    ],
  },
] as const;

export function GameNavigationMenu({
  showRaceSimulator = false,
}: GameNavigationMenuProps) {
  return (
    <details className="group relative shrink-0">
      <summary className="inline-flex h-10 cursor-pointer list-none items-center gap-2 rounded-lg border border-[#D6DFD2]/25 bg-white/5 px-3 text-xs font-extrabold uppercase tracking-[0.12em] text-[#D6DFD2] transition hover:border-[var(--game-header-accent)] hover:text-[var(--game-header-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)] [&::-webkit-details-marker]:hidden">
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className="h-4 w-4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13" />
        </svg>
        <span className="hidden sm:inline">Menu</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className="hidden h-3.5 w-3.5 transition group-open:rotate-180 sm:block"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 8 4 4 4-4" />
        </svg>
      </summary>

      <div className="absolute -left-16 top-[calc(100%+0.75rem)] z-50 w-[min(34rem,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-[#78947D]/45 bg-[#102D27] shadow-2xl shadow-black/45">
        <div className="border-b border-[#78947D]/30 bg-[#071A17] px-5 py-4">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--game-header-accent)]">
            Navigation
          </p>
          <p className="mt-1 text-sm font-semibold text-[#FFFDF4]">
            Toutes les rubriques de Cyclo Stratège
          </p>
        </div>

        <nav
          aria-label="Navigation principale du jeu"
          className="grid max-h-[min(70vh,42rem)] gap-5 overflow-y-auto p-4 sm:grid-cols-2 sm:p-5"
        >
          {NAVIGATION_GROUPS.map((group) => (
            <section key={group.label}>
              <h2 className="mb-2 text-[0.68rem] font-extrabold uppercase tracking-[0.18em] text-[#9BE0CA]">
                {group.label}
              </h2>
              <div className="space-y-1">
                {group.links.map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    className="block rounded-xl px-3 py-2.5 text-sm font-bold text-[#FFFDF4] transition hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)]"
                  >
                    {label}
                  </Link>
                ))}

                {group.label === "Communauté et aide" &&
                showRaceSimulator ? (
                  <Link
                    href="/jeu/simulateur-course"
                    className="block rounded-xl px-3 py-2.5 text-sm font-bold text-[#FFFDF4] transition hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)]"
                  >
                    Simulateur de course
                  </Link>
                ) : null}
              </div>
            </section>
          ))}
        </nav>
      </div>
    </details>
  );
}